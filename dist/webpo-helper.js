import { BG, buildURL, GOOG_API_KEY, USER_AGENT } from 'bgutils-js';
import { JSDOM } from 'jsdom';
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
let botguardEnvSetup = false;
/**
 * Sets up the global DOM environment BotGuard's VM expects. Only done once.
 * Mirrors the original lib-origin node_potoken implementation.
 */
function setupBotguardEnvironment() {
    if (botguardEnvSetup)
        return;
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
        url: 'https://www.youtube.com/',
        referrer: 'https://www.youtube.com/',
        userAgent: USER_AGENT
    });
    Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        location: dom.window.location,
        origin: dom.window.origin
    });
    if (!Reflect.has(globalThis, 'navigator')) {
        Object.defineProperty(globalThis, 'navigator', {
            value: dom.window.navigator
        });
    }
    // jsdom doesn't implement canvas; stub getContext so BotGuard's VM doesn't throw.
    Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', {
        value: () => null,
        writable: true
    });
    botguardEnvSetup = true;
}
/**
 * Generates a Web Proof-of-Origin (PoToken) using the same approach as the
 * original lib-origin node_potoken: it acquires the BotGuard challenge from
 * YouTube's own attestation API (innertube.getAttestationChallenge) rather
 * than bgutils-js' challenge server. This produces a token YouTube's SABR
 * backend actually accepts.
 *
 * @param innertube - The youtubei.js Innertube instance.
 * @param contentBinding - The content binding (video id) for the PoToken.
 */
export async function generateWebPoToken(innertube, contentBinding) {
    setupBotguardEnvironment();
    const visitorData = innertube.session.context.client.visitorData;
    if (!visitorData && !contentBinding) {
        throw new Error('No identifier provided and no visitorData on the Innertube session.');
    }
    // Acquire the BotGuard challenge from YouTube's attestation API.
    const challengeResponse = await innertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
    if (!challengeResponse.bg_challenge) {
        throw new Error('Could not get BotGuard challenge');
    }
    let interpreterUrl = challengeResponse.bg_challenge.interpreter_url
        .private_do_not_access_or_else_trusted_resource_url_wrapped_value ?? '';
    if (!interpreterUrl) {
        throw new Error('Could not get interpreter URL from BotGuard challenge');
    }
    if (interpreterUrl.startsWith('//')) {
        interpreterUrl = `https:${interpreterUrl}`;
    }
    // Fetch and execute the BotGuard interpreter script.
    const bgScriptResponse = await fetch(interpreterUrl);
    const interpreterJavascript = await bgScriptResponse.text();
    if (!interpreterJavascript) {
        throw new Error('Could not load VM');
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function(interpreterJavascript)();
    const botguard = await BG.BotGuardClient.create({
        program: challengeResponse.bg_challenge.program,
        globalName: challengeResponse.bg_challenge.global_name,
        globalObj: globalThis
    });
    const webPoSignalOutput = [];
    const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
    // Request an integrity token from YouTube.
    const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
        method: 'POST',
        headers: {
            'content-type': 'application/json+protobuf',
            'x-goog-api-key': GOOG_API_KEY,
            'x-user-agent': 'grpc-web-javascript/0.1',
            'user-agent': USER_AGENT
        },
        body: JSON.stringify([REQUEST_KEY, botguardResponse])
    });
    const integrityTokenData = (await integrityTokenResponse.json());
    if (typeof integrityTokenData[0] !== 'string') {
        throw new Error('Could not get integrity token');
    }
    const webPoMinter = await BG.WebPoMinter.create({ integrityToken: integrityTokenData[0] }, webPoSignalOutput);
    const poToken = await webPoMinter.mintAsWebsafeString(contentBinding);
    // generatePlaceholder throws if contentBinding > 118 UTF-8 bytes.
    // The video id is always short, so this is safe.
    const placeholderPoToken = BG.PoToken.generateColdStartToken(contentBinding);
    return {
        visitorData: visitorData ?? contentBinding,
        placeholderPoToken,
        poToken
    };
}
//# sourceMappingURL=webpo-helper.js.map