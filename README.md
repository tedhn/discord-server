# discord-server

Minimal Discord interactions endpoint. No dependencies — `node:http` plus
`node:crypto` for Ed25519 signature verification.

## Setup

1. Create an app at https://discord.com/developers/applications
2. Copy `.env.example` to `.env` and fill in the values.
3. Register the slash commands:

   ```sh
   npm run register
   ```

4. Start the server:

   ```sh
   npm start
   ```

5. Expose it publicly (Discord needs an HTTPS URL). For local development:

   ```sh
   ngrok http 3000
   ```

6. Paste `https://<your-host>/interactions` into the app's
   **Interactions Endpoint URL** field. Discord sends a signed PING and only
   accepts the URL if verification passes.

## Endpoints

| Method | Path            | Purpose                          |
| ------ | --------------- | -------------------------------- |
| POST   | `/interactions` | Discord interactions webhook     |
| GET    | `/health`       | Liveness check                   |

## Adding a command

Add a handler to the `commands` object in `server.js`, add the matching
definition to `commands` in `register-commands.js`, then re-run
`npm run register`.

## Notes

- Responses must be sent within 3 seconds. For slower work, reply with
  `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5) and then PATCH
  `/webhooks/{app_id}/{interaction_token}/messages/@original`.
- `flags: 1 << 6` makes a reply ephemeral (visible only to the invoker).
- This is a webhook-style bot. It cannot read message history or receive
  events like member joins — that requires a Gateway (WebSocket) connection.
