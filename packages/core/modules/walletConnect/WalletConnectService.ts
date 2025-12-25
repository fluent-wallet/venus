import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import type { Logger } from '@core/runtime/types';
import type Client from '@reown/walletkit';
import type { WalletKitTypes } from '@reown/walletkit';

export type WalletConnectSessionSnapshot = {
  topic: string;
  peer: {
    metadata: {
      name: string;
      url: string;
      icons?: string[];
    };
  };
  namespaces: {
    eip155?: {
      accounts: string[];
      chains?: string[];
      methods?: string[];
      events?: string[];
    };
  };
};

export type WalletConnectServiceOptions = {
  eventBus: EventBus<CoreEventMap>;
  logger: Logger;
  clientFactory: () => Promise<Client>;
  closeTransportOnStop: boolean;
};

export class WalletConnectService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly logger: Logger;
  private readonly clientFactory: () => Promise<Client>;
  private readonly closeTransportOnStop: boolean;

  private client: Client | null = null;
  private sessions: WalletConnectSessionSnapshot[] = [];
  private started = false;

  private readonly onSessionDelete = (event: WalletKitTypes.SessionDelete) => {
    void this.handleSessionDelete(event);
  };

  constructor(options: WalletConnectServiceOptions) {
    this.eventBus = options.eventBus;
    this.logger = options.logger;
    this.clientFactory = options.clientFactory;
    this.closeTransportOnStop = options.closeTransportOnStop;
  }

  public async start(): Promise<void> {
    if (this.started) return;

    const client = await this.clientFactory();
    this.client = client;

    client.on('session_delete', this.onSessionDelete);

    await this.refreshSessions();

    this.eventBus.emit('wallet-connect/sessions-changed', { reason: 'init' });
    this.started = true;
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      this.started = false;
      this.sessions = [];
      return;
    }

    const client = this.client;
    this.client = null;
    this.started = false;

    try {
      client.off('session_delete', this.onSessionDelete);
    } catch (error) {
      this.logger.warn('WalletConnectService:stop:off-failed', { error });
    }

    this.sessions = [];

    if (!this.closeTransportOnStop) return;

    try {
      const relayer = client.core?.relayer;
      if (relayer?.transportClose) {
        await relayer.transportClose();
      }
    } catch (error) {
      this.logger.warn('WalletConnectService:stop:transport-close-failed', { error });
    }
  }

  public getSessions(): WalletConnectSessionSnapshot[] {
    return this.sessions.slice();
  }

  private async handleSessionDelete(event: WalletKitTypes.SessionDelete): Promise<void> {
    if (!this.started) return;

    await this.refreshSessions();

    this.eventBus.emit('wallet-connect/sessions-changed', {
      reason: 'session_delete',
      topic: event.topic,
    });
  }

  private async refreshSessions(): Promise<void> {
    if (!this.client) {
      this.sessions = [];
      return;
    }

    const active = this.client.getActiveSessions();
    const snapshots = Object.values(active).map<WalletConnectSessionSnapshot>((session) => {
      const peerMeta = session.peer?.metadata;
      const metadata = {
        name: typeof peerMeta?.name === 'string' ? peerMeta.name : '',
        url: typeof peerMeta?.url === 'string' ? peerMeta.url : '',
        icons: Array.isArray(peerMeta?.icons) ? peerMeta.icons.filter((x): x is string => typeof x === 'string') : undefined,
      };

      const eip155 = (session.namespaces as unknown as { eip155?: Record<string, unknown> })?.eip155;
      const pickStringArray = (value: unknown): string[] | undefined => {
        if (!Array.isArray(value)) return undefined;
        const list = value.filter((x): x is string => typeof x === 'string');
        return list.length > 0 ? list : undefined;
      };

      return {
        topic: session.topic,
        peer: { metadata },
        namespaces: eip155
          ? {
              eip155: {
                accounts: pickStringArray((eip155 as Record<string, unknown>).accounts) ?? [],
                chains: pickStringArray((eip155 as Record<string, unknown>).chains),
                methods: pickStringArray((eip155 as Record<string, unknown>).methods),
                events: pickStringArray((eip155 as Record<string, unknown>).events),
              },
            }
          : {},
      };
    });

    snapshots.sort((a, b) => a.topic.localeCompare(b.topic));
    this.sessions = snapshots;
  }
}
