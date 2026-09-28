import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Una suscripción viva, con lo necesario para rehacerla tras una reconexión. */
interface Suscripcion {
  topic: string;
  entregar: (cuerpo: unknown) => void;
  stomp: StompSubscription | null;
}

/** Cada cuánto se pide a las pantallas recargar mientras no hay conexión en vivo. */
const SEGUNDOS_SIN_CONEXION = 20;

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private client: Client;

  /**
   * Estado real de la conexión. Las pantallas lo usan para su indicador de
   * "en vivo": antes cada una lo ponía en true por su cuenta y el punto verde
   * seguía encendido con la conexión muerta.
   */
  readonly connected = signal(false);

  /**
   * La sesión venció: el servidor ya no acepta la conexión con este token.
   * Antes el cliente reintentaba para siempre en silencio y la pantalla de
   * cocina se quedaba congelada sin que nadie lo notara.
   */
  readonly sesionVencida = signal(false);

  /**
   * Cambia cada vez que las pantallas deben volver a pedir sus datos:
   * - al reconectarse, porque lo que pasó mientras estaba caída no llegó;
   * - cada 20 s mientras no hay conexión, para no quedarse congeladas.
   */
  readonly sincronizar = signal(0);

  /**
   * Las suscripciones abiertas. Se guardan porque una suscripción de STOMP
   * muere junto con su sesión: si se cae la conexión y el cliente se vuelve a
   * conectar, hay que pedirlas de nuevo o la pantalla deja de recibir para
   * siempre sin avisar.
   */
  private readonly activas = new Map<symbol, Suscripcion>();
  private yaConecto = false;
  private tokenEnUso: string | null = null;
  private readonly relojSinConexion: ReturnType<typeof setInterval>;

  constructor() {
    let brokerURL = 'ws://localhost:8080/ws-pidefacil';
    if (environment.apiUrl) {
      const isHttps = environment.apiUrl.startsWith('https://');
      const baseDomain = environment.apiUrl
        .replace('https://', '')
        .replace('http://', '')
        .split('/')[0];

      const protocol = isHttps ? 'wss://' : 'ws://';
      brokerURL = `${protocol}${baseDomain}/ws-pidefacil`;
    }

    this.client = new Client({
      brokerURL: brokerURL,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      beforeConnect: async () => {
        const token = this.authService.token();
        // Con un token vencido el servidor rechaza la conexión una y otra vez.
        // Mejor parar y decirlo en pantalla que reintentar sin fin.
        if (!token || this.vencido(token)) {
          this.sesionVencida.set(!!token);
          await this.client.deactivate();
          return;
        }
        this.tokenEnUso = token;
        this.client.connectHeaders = { Authorization: `Bearer ${token}` };
      },
    });

    this.client.onConnect = () => {
      this.connected.set(true);
      this.sesionVencida.set(false);
      // Cada reconexión estrena sesión, así que las suscripciones anteriores
      // ya no existen del lado del servidor y hay que volver a pedirlas.
      this.activas.forEach((entrada) => this.abrir(entrada));
      if (this.yaConecto) {
        this.sincronizar.update((n) => n + 1);
      }
      this.yaConecto = true;
    };

    this.client.onDisconnect = () => this.marcarCaida();
    this.client.onWebSocketClose = () => this.marcarCaida();

    this.client.onStompError = (frame) => {
      this.marcarCaida();
      console.error('STOMP WebSocket protocol error', frame.headers['message'], frame.body);
    };

    // Al iniciar sesión (o cambiar de usuario) se conecta con el token nuevo.
    effect(() => {
      const token = this.authService.token();
      if (!token || this.vencido(token)) return;
      if (token === this.tokenEnUso && this.client.active) return;
      this.sesionVencida.set(false);
      void this.client.deactivate().then(() => this.client.activate());
    });

    // Sin conexión en vivo, las pantallas se refrescan solas cada tanto.
    this.relojSinConexion = setInterval(() => {
      if (this.connected()) return;
      const token = this.authService.token();
      if (token && this.vencido(token)) {
        this.sesionVencida.set(true);
        return;
      }
      if (token) this.sincronizar.update((n) => n + 1);
    }, SEGUNDOS_SIN_CONEXION * 1000);
  }

  /**
   * Escucha un canal. La suscripción sobrevive a las reconexiones: mientras
   * nadie se dé de baja del Observable, se vuelve a pedir sola.
   *
   * @param topic canal STOMP (p. ej. /topic/branches/{id}/tables)
   */
  subscribe<T>(topic: string): Observable<T> {
    return new Observable<T>((observer) => {
      const clave = Symbol(topic);
      const entrada: Suscripcion = {
        topic,
        entregar: (cuerpo) => observer.next(cuerpo as T),
        stomp: null,
      };

      this.activas.set(clave, entrada);
      if (this.client.connected) {
        this.abrir(entrada);
      }
      // Si todavía no hay conexión no se hace nada: onConnect la abrirá.

      return () => {
        entrada.stomp?.unsubscribe();
        this.activas.delete(clave);
      };
    });
  }

  private abrir(entrada: Suscripcion): void {
    // La sesión anterior ya no sirve; se suelta antes de pedir la nueva.
    entrada.stomp = null;
    entrada.stomp = this.client.subscribe(entrada.topic, (message) => {
      try {
        entrada.entregar(JSON.parse(message.body));
      } catch (e) {
        console.error('Failed to parse STOMP WebSocket message body', e);
      }
    });
  }

  private marcarCaida(): void {
    this.connected.set(false);
    // Los identificadores de la sesión caída no sirven para nada.
    this.activas.forEach((entrada) => (entrada.stomp = null));
  }

  /** El "exp" del JWT viene en segundos. Se deja un minuto de margen. */
  private vencido(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() + 60_000;
    } catch {
      return true;
    }
  }

  /**
   * Escucha los cambios de mesas de una sucursal.
   */
  subscribeToBranchTables<T>(branchId: string): Observable<T> {
    return this.subscribe<T>(`/topic/branches/${branchId}/tables`);
  }

  ngOnDestroy(): void {
    clearInterval(this.relojSinConexion);
    if (this.client) {
      this.client.deactivate();
    }
  }
}
