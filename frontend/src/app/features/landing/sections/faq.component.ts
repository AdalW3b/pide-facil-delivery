import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

@Component({
  selector: 'app-landing-faq',
  standalone: true,
  imports: [LucideChevronDown],
  template: `
    <section id="faq" class="scroll-mt-24 py-24 sm:py-32">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <div class="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Preguntas frecuentes</p>
            <h2 class="font-display mt-5 text-[1.8rem] sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
              Lo que suelen preguntarnos antes de empezar
            </h2>
          </div>

          <div class="divide-y divide-slate-800 border-t border-slate-800 lg:col-span-7 lg:col-start-6">
            @for (item of items; track item.question; let i = $index) {
              <div>
                <h3>
                  <button
                    type="button"
                    (click)="toggle(i)"
                    [attr.aria-expanded]="open() === i"
                    [attr.aria-controls]="'faq-panel-' + i"
                    class="group flex w-full cursor-pointer items-start justify-between gap-6 py-6 text-left"
                  >
                    <span
                      class="text-base font-semibold leading-snug transition-colors"
                      [class]="open() === i ? 'text-white' : 'text-slate-300 group-hover:text-white'"
                    >
                      {{ item.question }}
                    </span>
                    <svg
                      lucideChevronDown
                      class="mt-0.5 h-5 w-5 shrink-0 transition-transform duration-300"
                      [class]="open() === i ? 'rotate-180 text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'"
                    ></svg>
                  </button>
                </h3>

                @if (open() === i) {
                  <div
                    [id]="'faq-panel-' + i"
                    class="animate-fade-in max-w-xl pb-7 pr-8 text-[15px] leading-relaxed text-slate-400"
                  >
                    {{ item.answer }}
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFaqComponent {
  /** Índice abierto; `-1` cuando están todas cerradas. */
  readonly open = signal(0);

  readonly items: readonly FaqItem[] = [
    {
      question: '¿Tengo que cambiar mi número de WhatsApp?',
      answer:
        'No. Pide Facil se conecta al número que ya usas con tus clientes. Desde Ajustes vinculas la cuenta y el asistente empieza a responder ahí mismo, sin perder tus conversaciones anteriores.',
    },
    {
      question: '¿Qué pasa si el cliente prefiere hablar con una persona?',
      answer:
        'El asistente cede la conversación en cuanto detecta una consulta que no es un pedido, y tu equipo puede tomar el control del chat en cualquier momento desde el mismo WhatsApp.',
    },
    {
      question: '¿Necesito instalar algo en el restaurante?',
      answer:
        'Solo un navegador. El panel, la pantalla de cocina y la carta con QR funcionan en cualquier computadora, tablet o celular con internet.',
    },
    {
      question: '¿Sirve si tengo varias sucursales?',
      answer:
        'Sí. Cada sucursal tiene su carta, su stock, sus mesas y su equipo, pero tú ves los reportes consolidados desde una sola cuenta de administrador.',
    },
    {
      question: '¿Puedo limitar lo que ve cada empleado?',
      answer:
        'Los roles son configurables por permiso: un mesero puede ver solo el salón, cocina solo las comandas y el encargado además la analítica y los ajustes de la sucursal.',
    },
    {
      question: '¿Mis datos están seguros?',
      answer:
        'Cada sesión usa un token firmado con vencimiento y las peticiones se validan por sucursal en el servidor. Un usuario nunca puede leer información de un restaurante que no es el suyo.',
    },
    {
      question: '¿Cómo cancelo si no me sirve?',
      answer:
        'Desde tu panel, sin llamadas ni permanencia. Puedes exportar tu historial de ventas y tu catálogo antes de irte.',
    },
  ];

  toggle(index: number): void {
    this.open.update((current) => (current === index ? -1 : index));
  }
}
