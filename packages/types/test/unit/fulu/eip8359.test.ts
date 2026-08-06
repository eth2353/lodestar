import {describe, expect, it} from "vitest";
import {ssz} from "../../../src/index.js";

describe("EIP-8359 client data", () => {
  it("adds client_data to Fulu beacon block bodies only", () => {
    expect(ssz.fulu.BeaconBlockBody.fields.clientData).toBe(ssz.Bytes32);
    expect(ssz.fulu.BlindedBeaconBlockBody.fields.clientData).toBe(ssz.Bytes32);
    expect("clientData" in ssz.electra.BeaconBlockBody.fields).toBe(false);
    expect("clientData" in ssz.gloas.BeaconBlockBody.fields).toBe(false);
  });

  it("includes arbitrary client_data bytes in serialization and the hash tree root", () => {
    const zero = ssz.fulu.BeaconBlockBody.defaultValue();
    const withClientData = ssz.fulu.BeaconBlockBody.clone(zero);
    withClientData.clientData = new Uint8Array(32).fill(0xff);

    expect(ssz.fulu.BeaconBlockBody.serialize(zero)).toHaveLength(
      ssz.electra.BeaconBlockBody.serialize(ssz.electra.BeaconBlockBody.defaultValue()).length + 32
    );
    expect(ssz.fulu.BeaconBlockBody.hashTreeRoot(withClientData)).not.toEqual(
      ssz.fulu.BeaconBlockBody.hashTreeRoot(zero)
    );
  });
});
