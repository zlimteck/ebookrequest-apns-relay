# EbookRequest APNs Relay

Petit service Node/Express qui relaie des notifications push APNs pour le compte
des instances self-hostées d'EbookRequest, sans jamais leur exposer la clé
privée `.p8` d'Apple Developer.

Chaque instance appelante possède son propre jeton d'API et appelle `POST
/send` au lieu de parler directement à APNs.

## Démarrage

```bash
cp .env.example .env
cp instances.example.json instances.json
npm install
npm start
```

`GET /health` répond toujours, même si APNs n'est pas encore configuré (log
`[APNs] Relais non configuré` au démarrage dans ce cas, pas de crash).

## Ajouter une instance

Deux méthodes cohabitent — dans les deux cas, le contrôle de **qui** est
autorisé reste entièrement manuel (approbation explicite requise), seule la
génération du jeton peut être automatisée côté instance demandeuse.

### Méthode manuelle (comme avant)

Le jeton lui-même n'est jamais stocké : seul son hash SHA-256 l'est. Générez un
jeton aléatoire haute entropie côté opérateur du relais, par exemple :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Puis calculez son hash :

```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "<le-jeton-genere>"
```

Ajoutez une entrée dans `instances.json` :

```json
[
  {
    "instanceId": "instance-de-jean",
    "label": "Instance self-hostée de Jean",
    "apiKeyHash": "<hash-sha256-hex>"
  }
]
```

Redémarrez le service (ou relancez le conteneur) pour recharger le fichier.
Transmettez le jeton **en clair** (non le hash) à l'opérateur de l'instance —
c'est ce qu'il devra envoyer dans le header `Authorization`. Une instance sans
champ `status` est traitée comme `"active"` (compatibilité avec les entrées
ajoutées avant l'introduction du flux d'approbation ci-dessous).

### Méthode auto-service avec approbation manuelle

L'instance demandeuse génère elle-même son jeton en appelant le relais ; il
reste inutilisable tant que vous ne l'avez pas approuvé.

1. **La personne self-hostée** appelle :

   ```bash
   curl -X POST https://votre-relais/register-request \
     -H "Content-Type: application/json" \
     -d '{
       "instanceId": "instance-de-jean",
       "label": "Instance self-hostée de Jean",
       "domain": "ebooks.jean.example.com",
       "contactEmail": "jean@example.com"
     }'
   ```

   Réponse : `{ "token": "..." }` — affiché **une seule fois**, à stocker
   immédiatement côté instance. Ce jeton ne fonctionnera pas sur `/send` tant
   que la demande n'est pas approuvée (statut `pending`). Limité à 5
   requêtes/heure par IP.

2. **Vous êtes notifié** : un log `[Register] Nouvelle demande en attente...`
   apparaît dans les logs Docker, et si `NOTIFY_WEBHOOK_URL` est configuré
   (ntfy.sh, Discord/Slack via un endpoint compatible `{ "text": "..." }`),
   un message y est aussi envoyé.

3. **Vous consultez les demandes en attente** (nécessite `ADMIN_SECRET`,
   voir `.env.example`) :

   ```bash
   curl https://votre-relais/admin/pending \
     -H "Authorization: Bearer <ADMIN_SECRET>"
   ```

4. **Vous approuvez** (l'instance peut alors utiliser `/send`) :

   ```bash
   curl -X POST https://votre-relais/admin/approve/instance-de-jean \
     -H "Authorization: Bearer <ADMIN_SECRET>"
   ```

   Ou vous **rejetez** (supprime la demande) :

   ```bash
   curl -X POST https://votre-relais/admin/reject/instance-de-jean \
     -H "Authorization: Bearer <ADMIN_SECRET>"
   ```

Sans `ADMIN_SECRET` défini, les routes `/admin/*` renvoient `503` — le service
ne s'ouvre jamais en administration "par défaut".

## Comment une instance EbookRequest doit appeler `/send`

```
POST /send
Authorization: Bearer <jeton-assigné-par-l-operateur-du-relais>
Content-Type: application/json

{
  "deviceTokens": ["abcd1234...", "ef567890..."],
  "title": "Nouvelle requête",
  "body": "Un livre a été ajouté à votre liste",
  "url": "/requests/42"
}
```

Réponse :

```json
{ "sent": 1, "failed": 1, "invalidTokens": ["ef567890..."] }
```

`invalidTokens` liste les tokens qu'Apple a signalés comme définitivement
invalides (désinstallation, expiration) — c'est à l'instance appelante de les
supprimer de sa propre base de `DeviceToken`, le relais ne les connaît pas et
ne les conserve pas.

## Exemple curl de test

```bash
curl -X POST http://localhost:3040/send \
  -H "Authorization: Bearer <jeton>" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceTokens": ["<device-token-de-test>"],
    "title": "Test",
    "body": "Ceci est un test",
    "url": "/"
  }'
```

## Sécurité

- Jeton absent ou invalide → `401` générique (aucune information sur les
  instances existantes n'est révélée).
- Une instance au statut `pending` ne peut jamais envoyer de push, même avec
  le bon jeton — seul `/admin/approve/:instanceId` débloque `/send`.
- Rate limiting par instance : 100 requêtes/minute sur `/send`. Par IP : 30
  requêtes/minute sur les tentatives d'auth (`/send` avant vérification du
  jeton), 5/heure sur `/register-request`.
- `/admin/*` protégé par `ADMIN_SECRET` (comparaison à temps constant),
  distinct des jetons d'instance ; renvoie `503` si non configuré.
- Aucune route d'enregistrement de device token ici : chaque instance gère ses
  propres tokens côté client, le relais ne fait que transmettre le payload
  final à Apple.

## Déploiement Docker

```bash
docker compose up -d --build
```

Voir `docker-compose.yml` pour les limites de ressources (0.5 CPU / 512 Mo,
large marge au-dessus du besoin réel).

### Déploiement en stack via Portainer (dossier local sur le même serveur)

- **En SSH direct sur le serveur**, depuis ce dossier : `docker compose up -d
  --build` fonctionne tel quel, `build: context: .` pointe sur le dossier
  courant.
- **Via l'UI Portainer** (Stacks → Add stack → Web editor, contenu du compose
  collé manuellement) : Portainer exécute le compose depuis son propre dossier
  interne (`/data/compose/<id>/`), donc `context: .` ne trouvera pas le
  `Dockerfile` ici. Remplacer dans `docker-compose.yml` :

  ```yaml
  build:
    context: /chemin/absolu/vers/ce/dossier/sur/le/serveur
    dockerfile: Dockerfile
  ```

Dans les deux cas, `instances.json` doit exister dans ce dossier sur le
serveur (copié depuis `instances.example.json` puis rempli, voir plus haut) —
il n'est jamais versionné dans Git (`.gitignore`).
