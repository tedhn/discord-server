import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT || 3000;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

if (!PUBLIC_KEY) {
  console.error('Missing DISCORD_PUBLIC_KEY env var (Discord app settings > General Information).');
  process.exit(1);
}

// Discord interaction types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
};

// Discord interaction response types
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
};

// Discord signs every request with Ed25519. Verifying it is mandatory:
// the endpoint is public, and Discord rejects the URL unless invalid
// signatures get a 401.
const publicKeyObject = crypto.createPublicKey({
  key: Buffer.concat([
    // DER prefix for an Ed25519 SubjectPublicKeyInfo structure
    Buffer.from('302a300506032b6570032100', 'hex'),
    Buffer.from(PUBLIC_KEY, 'hex'),
  ]),
  format: 'der',
  type: 'spki',
});

function verifySignature(signature, timestamp, rawBody) {
  if (!signature || !timestamp) return false;
  let sig;
  try {
    sig = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  if (sig.length !== 64) return false;
  return crypto.verify(
    null,
    Buffer.concat([Buffer.from(timestamp), rawBody]),
    publicKeyObject,
    sig,
  );
}

function readRawBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function text(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(body);
}

// Slash command handlers. Add a key per command name.
const commands = {
  ping: () => ({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Pong!' },
  }),

  echo: (interaction) => {
    const option = interaction.data.options?.find((o) => o.name === 'text');
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: option?.value || '(nothing to echo)',
        // Only the invoking user sees an ephemeral reply.
        flags: 1 << 6,
      },
    };
  },
};

function handleInteraction(interaction) {
  switch (interaction.type) {
    case InteractionType.PING:
      return { type: InteractionResponseType.PONG };

    case InteractionType.APPLICATION_COMMAND: {
      const handler = commands[interaction.data.name];
      if (!handler) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `Unknown command: ${interaction.data.name}`, flags: 1 << 6 },
        };
      }
      return handler(interaction);
    }

    case InteractionType.MESSAGE_COMPONENT:
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `Button clicked: ${interaction.data.custom_id}`, flags: 1 << 6 },
      };

    default:
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Unsupported interaction type.', flags: 1 << 6 },
      };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true });
  }

  if (req.method !== 'POST' || req.url !== '/interactions') {
    return text(res, 404, 'Not Found');
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return text(res, 413, 'Payload Too Large');
  }

  const valid = verifySignature(
    req.headers['x-signature-ed25519'],
    req.headers['x-signature-timestamp'],
    rawBody,
  );

  if (!valid) {
    return text(res, 401, 'Invalid request signature');
  }

  let interaction;
  try {
    interaction = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return text(res, 400, 'Bad Request');
  }

  try {
    return json(res, 200, handleInteraction(interaction));
  } catch (err) {
    console.error('Handler error:', err);
    return json(res, 200, {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Something went wrong.', flags: 1 << 6 },
    });
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Interactions endpoint: POST /interactions`);
});
