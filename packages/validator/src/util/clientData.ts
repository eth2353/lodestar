import {Bytes32} from "@lodestar/types";

export enum ClientDataSetup {
  Undefined = 0,
  Unknown = 1,
  Other = 2,
  Simple = 3,
  Obol = 4,
  Ssv = 5,
  Vero = 6,
  Vouch = 7,
}

export enum ClientDataConsensusClient {
  Undefined = 0,
  Unknown = 1,
  Other = 2,
  Caplin = 3,
  Grandine = 4,
  Lighthouse = 5,
  Lodestar = 6,
  Nimbus = 7,
  Teku = 8,
  Prysm = 9,
}

export enum ClientDataExecutionClient {
  Undefined = 0,
  Unknown = 1,
  Other = 2,
  Besu = 3,
  Erigon = 4,
  Ethrex = 5,
  Geth = 6,
  Nethermind = 7,
  Nimbus = 8,
  Reth = 9,
}

export type ClientDataClientPair = {
  consensus: ClientDataConsensusClient;
  execution: ClientDataExecutionClient;
};

export type ClientDataConfig = {
  version: number;
  setup: ClientDataSetup;
  threshold: number;
  clientPairs: ClientDataClientPair[];
};

export function encodeClientData({version, setup, threshold, clientPairs}: ClientDataConfig): Bytes32 {
  if (version < 0 || version > 0xff) {
    throw Error(`Invalid client data version=${version}`);
  }
  if (setup < 0 || setup > 0x1f) {
    throw Error(`Invalid client data setup=${setup}`);
  }
  if (threshold < 0 || threshold > 0x07) {
    throw Error(`Invalid client data threshold=${threshold}`);
  }
  if (clientPairs.length > 14) {
    throw Error(`Too many client data pairs count=${clientPairs.length}`);
  }

  const clientData = new Uint8Array(32);
  clientData[0] = version;
  clientData[1] = (setup << 3) | threshold;

  for (const [index, pair] of clientPairs.entries()) {
    if (pair.consensus < 0 || pair.consensus > 0x0f || pair.execution < 0 || pair.execution > 0x0f) {
      throw Error(`Invalid client data pair at index=${index}`);
    }
    clientData[index + 2] = (pair.consensus << 4) | pair.execution;
  }

  return clientData;
}

export const DEFAULT_CLIENT_DATA = encodeClientData({
  version: 1,
  setup: ClientDataSetup.Simple,
  threshold: 1,
  clientPairs: [
    {
      consensus: ClientDataConsensusClient.Lodestar,
      execution: ClientDataExecutionClient.Unknown,
    },
  ],
});
