import {AbortController} from "abort-controller";
import {IBeaconConfig} from "@chainsafe/lodestar-config";
import {ApiClientEventEmitter, IApiClient, IBeaconClock} from "./interface";
import {IBeaconApi} from "./interface/beacon";
import {IValidatorApi} from "./interface/validators";
import {EventEmitter} from "events";
import {INodeApi} from "./interface/node";
import {ILogger, IStoppableEventIterable} from "@chainsafe/lodestar-utils";
import {BeaconEvent, BeaconEventType, IEventsApi} from "./interface/events";
import {LocalClock} from "./LocalClock";
import {pipeToEmitter} from "./impl/rest/events/util";

export abstract class AbstractApiClient extends (EventEmitter as {new (): ApiClientEventEmitter})
  implements IApiClient {
  public clock!: IBeaconClock;

  protected config: IBeaconConfig;
  protected logger: ILogger;
  private controller!: AbortController;

  private running = false;
  private beaconNodeInterval?: NodeJS.Timeout;
  private slotCountingTimeout?: NodeJS.Timeout;
  private genesisTime?: number;
  private stream?: IStoppableEventIterable<BeaconEvent>;
  private streamPromise?: Promise<void>;

  public abstract url: string;
  abstract beacon: IBeaconApi;
  abstract node: INodeApi;
  abstract events: IEventsApi;
  abstract validator: IValidatorApi;

  protected constructor(config: IBeaconConfig, logger: ILogger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  public async connect(): Promise<void> {
    if (!this.beaconNodeInterval) {
      this.controller = new AbortController();
      this.running = true;
      await this.pollBeaconNode();
      this.beaconNodeInterval = setInterval(this.pollBeaconNode.bind(this), 3000);
    }
  }

  public async disconnect(): Promise<void> {
    this.running = false;
    if (this.beaconNodeInterval) {
      clearInterval(this.beaconNodeInterval);
    }
    if (this.slotCountingTimeout) {
      clearTimeout(this.slotCountingTimeout);
    }
    if (this.stream) {
      this.stream.stop();
    }
    this.controller.abort();
  }

  private async pollBeaconNode(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.logger.info("Checking genesis time and beacon node connection");
    const genesis = await this.beacon.getGenesis();
    if (genesis && Math.floor(Date.now() / 1000) >= genesis.genesisTime) {
      if (this.beaconNodeInterval) {
        clearInterval(this.beaconNodeInterval);
      }
      this.startSlotCounting(Number(genesis.genesisTime));
      this.emit("beaconChainStarted");
    } else {
      let waitTime = "unknown";
      if (genesis) {
        waitTime = genesis.genesisTime - BigInt(Math.floor(Date.now() / 1000)) + "s";
      }
      this.logger.info("Waiting for genesis time", {waitTime});
    }
  }

  private startSlotCounting(genesisTime: number): void {
    this.genesisTime = genesisTime;
    this.stream = this.events.getEventStream([
      BeaconEventType.BLOCK,
      BeaconEventType.HEAD,
      BeaconEventType.CHAIN_REORG,
    ]);
    this.streamPromise = pipeToEmitter(this.stream, this);
    // CLOCK_SLOT and CLOCK_EPOCH currently being emitted from this LocalClock
    this.clock = new LocalClock({
      config: this.config,
      genesisTime,
      emitter: this,
      signal: this.controller.signal,
    });
  }
}
