import { Innertube, UniversalCache, ClientType, YTNodes } from 'youtubei.js';

const IDS = ['4D7u5KF7SP8', 'kJQP7kiw5Fk'];

async function main() {
  const innertube = await Innertube.create({ cache: new UniversalCache(true), client_type: ClientType.WEB });

  for (const id of IDS) {
    console.log(`\n=== ${id} ===`);
    for (const client of ['YTMUSIC', 'WEB']) {
      try {
        const watchEndpoint = new YTNodes.NavigationEndpoint({
          watchEndpoint: { videoId: id, racyCheckOk: true, contentCheckOk: true }
        });
        const playerResponse: any = await watchEndpoint.call(innertube.actions, {
          playbackContext: {
            contentPlaybackContext: {
              vis: 0, splay: false, lactMilliseconds: '-1',
              signatureTimestamp: innertube.session.player?.signature_timestamp,
              isInlinePlaybackNoAd: true
            }
          },
          client,
          parse: true
        });
        console.log(`  [${client}] playabilityStatus=${playerResponse.playability_status?.status} reason=${playerResponse.playability_status?.reason}`);
        console.log(`  [${client}] has server_abr_streaming_url=${!!playerResponse.streaming_data?.server_abr_streaming_url} adaptive_formats=${playerResponse.streaming_data?.adaptive_formats?.length}`);
      } catch (e: any) {
        console.log(`  [${client}] THREW: ${e.message}`);
      }
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
