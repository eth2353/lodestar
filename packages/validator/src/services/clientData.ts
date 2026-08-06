import {ApiClient, routes} from "@lodestar/api";
import {IClock} from "@lodestar/state-transition";
import {Bytes32} from "@lodestar/types";
import {toPrintableUrl} from "@lodestar/utils";
import {
  ClientDataClientPair,
  ClientDataConsensusClient,
  ClientDataExecutionClient,
  ClientDataSetup,
  DEFAULT_CLIENT_DATA,
  encodeClientData,
} from "../util/clientData.js";
import {LoggerVc} from "../util/index.js";

const MAX_CLIENT_PAIRS = 14;

export class ClientDataService {
  private readonly clientPairsByUrl = new Map<string, ClientDataClientPair>();
  private readonly failedUrls = new Set<string>();
  private warnedTooManyPairs = false;
  private clientData: Bytes32;

  private constructor(
    private readonly logger: LoggerVc,
    clock: IClock,
    private readonly apis: ApiClient[],
    private readonly setup: ClientDataSetup
  ) {
    this.clientData = DEFAULT_CLIENT_DATA;
    clock.runEveryEpoch(this.pollClientVersions);
  }

  static async init(
    logger: LoggerVc,
    clock: IClock,
    apis: ApiClient[],
    setup: ClientDataSetup
  ): Promise<ClientDataService> {
    const service = new ClientDataService(logger, clock, apis, setup);
    await service.pollClientVersions();
    return service;
  }

  getClientData(): Bytes32 {
    return this.clientData;
  }

  private pollClientVersions = async (): Promise<void> => {
    await Promise.all(
      this.apis.map(async (api) => {
        const url = api.httpClient.baseUrl;

        try {
          const {beaconNode, executionClient} = (await api.node.getNodeVersionV2()).value();
          this.clientPairsByUrl.set(url, {
            consensus: toConsensusClient(beaconNode.code),
            execution:
              executionClient === undefined
                ? ClientDataExecutionClient.Unknown
                : toExecutionClient(executionClient.code),
          });
          this.failedUrls.delete(url);
        } catch (e) {
          const logCtx = {url: toPrintableUrl(url)};
          if (this.failedUrls.has(url)) {
            this.logger.debug("Failed to refresh beacon node client version", logCtx, e as Error);
          } else {
            this.logger.warn("Failed to fetch beacon node client version", logCtx, e as Error);
            this.failedUrls.add(url);
          }
        }
      })
    );

    const clientPairs: ClientDataClientPair[] = [];
    const seenPairs = new Set<number>();
    for (const api of this.apis) {
      const pair = this.clientPairsByUrl.get(api.httpClient.baseUrl);
      if (pair === undefined) continue;

      const pairId = (pair.consensus << 4) | pair.execution;
      if (!seenPairs.has(pairId)) {
        seenPairs.add(pairId);
        clientPairs.push(pair);
      }
    }

    if (clientPairs.length === 0) return;

    if (clientPairs.length > MAX_CLIENT_PAIRS && !this.warnedTooManyPairs) {
      this.logger.warn("Client data has more client pairs than can be encoded", {
        count: clientPairs.length,
        included: MAX_CLIENT_PAIRS,
      });
      this.warnedTooManyPairs = true;
    }

    this.clientData = encodeClientData({
      version: 1,
      setup: this.setup,
      threshold: 1,
      clientPairs: clientPairs.slice(0, MAX_CLIENT_PAIRS),
    });
  };
}

function toConsensusClient(code: routes.node.ClientCode): ClientDataConsensusClient {
  switch (code) {
    case routes.node.ClientCode.CN:
      return ClientDataConsensusClient.Caplin;
    case routes.node.ClientCode.GR:
      return ClientDataConsensusClient.Grandine;
    case routes.node.ClientCode.LH:
      return ClientDataConsensusClient.Lighthouse;
    case routes.node.ClientCode.LS:
      return ClientDataConsensusClient.Lodestar;
    case routes.node.ClientCode.NB:
      return ClientDataConsensusClient.Nimbus;
    case routes.node.ClientCode.TK:
      return ClientDataConsensusClient.Teku;
    case routes.node.ClientCode.PM:
      return ClientDataConsensusClient.Prysm;
    case routes.node.ClientCode.XX:
      return ClientDataConsensusClient.Unknown;
    default:
      return ClientDataConsensusClient.Other;
  }
}

function toExecutionClient(code: routes.node.ClientCode): ClientDataExecutionClient {
  switch (code) {
    case routes.node.ClientCode.BU:
      return ClientDataExecutionClient.Besu;
    case routes.node.ClientCode.EG:
      return ClientDataExecutionClient.Erigon;
    case routes.node.ClientCode.EX:
      return ClientDataExecutionClient.Ethrex;
    case routes.node.ClientCode.GE:
      return ClientDataExecutionClient.Geth;
    case routes.node.ClientCode.NM:
      return ClientDataExecutionClient.Nethermind;
    case routes.node.ClientCode.NE:
      return ClientDataExecutionClient.Nimbus;
    case routes.node.ClientCode.RH:
      return ClientDataExecutionClient.Reth;
    case routes.node.ClientCode.XX:
      return ClientDataExecutionClient.Unknown;
    default:
      return ClientDataExecutionClient.Other;
  }
}
