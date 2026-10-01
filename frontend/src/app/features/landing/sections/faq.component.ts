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
    <section id="faq" class="scroll-mt-24 bg-(--papel-2) py-20 lg:py-28" aria-labelledby="faq-titulo">
      <div class="mx-auto max-w-6xl px-5 sm:px-8">
        <div class="grid gap-10 lg:grid-cols-12">
          <div class="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p class="lp-mono text-xs uppercase tracking-[0.18em] text-(--chile)">Preguntas</p>
            <h2 id="faq-titulo" class="lp-display mt-3 text-3xl font-extrabold leading-tight text-(--tinta) sm:text-4xl text-balance">
              Lo que nos preguntan antes de empezar
            </h2>
          </div>
          <div class="lg:col-span-8 divide-y divide-(--linea) border-y border-(--linea)">
            @for (item of items; track item.question; let i = $index) {
              <div>
                <h3>
                  <button type="button" (click)="toggle(i)" [attr.aria-expanded]="open() === i" [attr.aria-controls]="'faq-panel-' + i"
                    class="group flex w-full items-center justify-between gap-6 py-5 text-left cursor-pointer">
                    <span class="text-[17px] font-semibold text-(--tinta)">{{ item.question }}</span>
                    <svg lucideChevronDown class="h-5 w-5 shrink-0 transition-transform duration-200"
                      [class]="open() === i ? 'rotate-180 text-(--chile)' : 'text-(--tinta-2)'"></svg>
                  </button>
                </h3>
                @if (open() === i) {
                  <div [id]="'faq-panel-' + i" class="animate-fade-in max-w-2xl pb-6 text-[15px] leading-relaxed text-(--tinta-2)">
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
        'No. Vinculas el número que ya usas escaneando un código QR, como en WhatsApp Web. Tus clientes te siguen escribiendo al mismo número.',
    },
    {
      question: '¿Puedo contestar yo cuando el cliente pregunta otra cosa?',
      answer:
        'Sí. Las conversaciones siguen en tu WhatsApp, así que tú o tu equipo pueden escribirle al cliente cuando quieran.',
    },
    {
      question: '¿Cobran comisión por pedido?',
      answer:
        'No. Pagas una cuota fija por sucursal. Todo lo que vendes por WhatsApp, menú en línea o teléfono es tuyo.',
    },
    {
      question: '¿Cómo se calcula el envío?',
      answer:
        'Por distancia desde tu sucursal: pones una tarifa con algunos kilómetros incluidos, el costo de cada kilómetro extra y hasta dónde repartes. También decides si absorbes parte del envío y cuánto le pagas al repartidor por entrega.',
    },
    {
      question: '¿Mis repartidores necesitan instalar una app?',
      answer:
        'No. Cada repartidor entra con una liga desde su celular, confirma con un código y ve sus entregas con la dirección y el botón para abrir el mapa.',
    },
    {
      question: '¿Necesito comprar equipo?',
      answer:
        'No. El panel, la pantalla de cocina y el menú funcionan en cualquier computadora, tablet o celular con internet.',
    },
    {
      question: '¿Sirve si tengo varias sucursales?',
      answer:
        'Sí. Cada sucursal tiene su menú, sus existencias, sus mesas y su equipo, y tú ves los reportes de una o de todas juntas.',
    },
    {
      question: '¿Puedo limitar lo que ve cada empleado?',
      answer:
        'Sí. Los roles se arman por permiso: el mesero ve el salón, cocina sus comandas y el encargado además los reportes de su sucursal.',
    },
    {
      question: '¿Cómo cancelo?',
      answer: 'Sin plazo forzoso. Antes de irte puedes exportar a Excel tus ventas, platillos y meseros desde Reportes.',
    },
  ];

  toggle(index: number): void {
    this.open.update((current) => (current === index ? -1 : index));
  }
}
