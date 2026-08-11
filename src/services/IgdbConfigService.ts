/**
 * IgdbConfigService — Manages IGDB API Credentials & Twitch OAuth Token Lifecycle
 */

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  autoFetchMetadata: boolean;
}

const STORAGE_KEY = "retro_hub_igdb_credentials";

export class IgdbConfigService {
  private credentials: IgdbCredentials;

  constructor() {
    this.credentials = this.load();
  }

  private load(): IgdbCredentials {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {
      clientId: "",
      clientSecret: "",
      accessToken: "",
      autoFetchMetadata: true,
    };
  }

  public getCredentials(): IgdbCredentials {
    return { ...this.credentials };
  }

  public saveCredentials(creds: Partial<IgdbCredentials>): void {
    this.credentials = { ...this.credentials, ...creds };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.credentials));
    } catch {
      // ignore
    }
  }

  public isConfigured(): boolean {
    return (
      Boolean(this.credentials.clientId.trim()) &&
      Boolean(this.credentials.clientSecret.trim())
    );
  }

  /**
   * Automates retrieval and refresh of Twitch OAuth2 access token.
   * Returns a valid access token string, or null if configuration is incomplete/failed.
   */
  public async getValidAccessToken(): Promise<string | null> {
    const { clientId, clientSecret, accessToken, tokenExpiresAt } = this.credentials;

    if (!clientId.trim() || !clientSecret.trim()) {
      return null;
    }

    // 1. Return cached token if still valid (with 60 seconds safety margin)
    if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
      return accessToken;
    }

    // 2. Fetch new OAuth token from Twitch endpoint
    try {
      const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(
        clientId.trim()
      )}&client_secret=${encodeURIComponent(clientSecret.trim())}&grant_type=client_credentials`;

      const response = await fetch(url, { method: "POST" });
      const data = await response.json();

      if (response.ok && data.access_token) {
        const expiresInMs = (data.expires_in || 3600) * 1000;
        const expiresAt = Date.now() + expiresInMs;

        this.saveCredentials({
          accessToken: data.access_token,
          tokenExpiresAt: expiresAt,
        });

        return data.access_token;
      }
    } catch (err) {
      console.error("[Twitch OAuth] Failed to retrieve access token:", err);
    }

    return null;
  }

  /**
   * Test connection to IGDB by attempting to retrieve a valid OAuth token.
   */
  public async testOrRefreshToken(): Promise<{ success: boolean; message: string }> {
    const { clientId, clientSecret } = this.credentials;

    if (!clientId.trim()) {
      return { success: false, message: "Client ID manquant." };
    }
    if (!clientSecret.trim()) {
      return { success: false, message: "Client Secret manquant." };
    }

    // Force clear old cached token to test fresh generation
    this.saveCredentials({ accessToken: "", tokenExpiresAt: 0 });

    const token = await this.getValidAccessToken();
    if (token) {
      return {
        success: true,
        message: "Connexion réussie ! Jeton OAuth2 récupéré automatiquement auprès de Twitch.",
      };
    } else {
      return {
        success: false,
        message: "Échec de connexion : vérifiez votre Client ID et Client Secret.",
      };
    }
  }
}

export const igdbConfigService = new IgdbConfigService();
