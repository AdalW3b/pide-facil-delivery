import { UNIDADES_DE_INVENTARIO, cantidadLegible, convertirUnidad, unidadCanonica, unidadesCompatibles } from '../../shared/utils/unidades';
import { TituloPaginaComponent } from '../../shared/components/titulo-pagina.component';
import { AvisosService } from '../../core/services/avisos.service';
import { SucursalActivaService } from '../../core/services/sucursal-activa.service';
import { sucursalInicial } from '../../shared/utils/sucursal-inicial';
import { PesosPipe } from '../../shared/utils/pesos';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { Restaurant, Branch } from '../admin-core/models/admin.model';
import { Category, Product, Ingredient, RecipeItem } from './models/catalog.model';
import { AdicionalesAdminComponent } from './adicionales-admin.component';
import { MovimientoInventarioComponent, ObjetivoInventario } from './movimiento-inventario.component';
import { HistorialInventarioComponent } from './historial-inventario.component';
import { ControlInventarioComponent } from './control-inventario.component';
import { comprimirImagen } from '../../shared/utils/imagen';
import { 
  LucidePlus, 
  LucideEdit, 
  LucideTrash2, 
  LucideGrid, 
  LucideList, 
  LucideSearch, 
  LucideX, 
  LucideLoader2, 
  LucideTag, 
  LucideAlertCircle,
  LucidePackage,
  LucideChefHat,
  LucideBoxes,
  LucideRefreshCw,
  LucideChevronDown,
  LucideChevronUp,
  LucideLayers
} from '@lucide/angular';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [TituloPaginaComponent, PesosPipe, 
    CommonModule, 
    FormsModule, 
    LucidePlus, 
    LucideEdit, 
    LucideTrash2, 
    LucideGrid, 
    LucideList, 
    LucideSearch, 
    LucideX, 
    LucideLoader2, 
    LucideTag, 
    LucideAlertCircle,
    LucidePackage,
    LucideChefHat,
    LucideBoxes,
    LucideRefreshCw,
    LucideChevronDown,
    LucideChevronUp,
    LucideLayers,
    AdicionalesAdminComponent,
    MovimientoInventarioComponent,
    HistorialInventarioComponent,
    ControlInventarioComponent
  ],
  template: `
    <div class="space-y-6 select-none">
      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <app-titulo-pagina titulo="Catálogo" descripcion="Platillos, fotos, ingredientes y adicionales del menú." />
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Background Sync Indicator -->
          @if (isSyncing()) {
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-400 uppercase tracking-wider shrink-0">
              <svg lucideLoader2 class="animate-spin w-3.5 h-3.5"></svg>
              <span>Sincronizando...</span>
            </div>
          }
          
          <button
            (click)="reloadAll()"
            [disabled]="isLoading()"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
          >
            <svg lucideRefreshCw [class.animate-spin]="isLoading()" class="w-4 h-4"></svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>


      <!-- Navigation Tabs Selector -->
      <div class="flex items-center gap-2 border-b border-slate-800/80 pb-4">
        <button
          (click)="activeTab.set('products')"
          [class.bg-indigo-600]="activeTab() === 'products'"
          [class.text-white]="activeTab() === 'products'"
          [class.shadow-indigo-600\/20]="activeTab() === 'products'"
          [class.bg-slate-900\/60]="activeTab() !== 'products'"
          [class.text-slate-400]="activeTab() !== 'products'"
          [class.hover:text-white]="activeTab() !== 'products'"
          class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-slate-800/60"
        >
          <svg lucidePackage class="w-4 h-4"></svg>
          <span>Productos</span>
        </button>

        <button
          (click)="activeTab.set('ingredients')"
          [class.bg-indigo-600]="activeTab() === 'ingredients'"
          [class.text-white]="activeTab() === 'ingredients'"
          [class.shadow-indigo-600\/20]="activeTab() === 'ingredients'"
          [class.bg-slate-900\/60]="activeTab() !== 'ingredients'"
          [class.text-slate-400]="activeTab() !== 'ingredients'"
          [class.hover:text-white]="activeTab() !== 'ingredients'"
          class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-slate-800/60"
        >
          <svg lucideChefHat class="w-4 h-4"></svg>
          <span>Ingredientes (Materia Prima)</span>
        </button>

        <button
          (click)="activeTab.set('adicionales')"
          [class.bg-indigo-600]="activeTab() === 'adicionales'"
          [class.text-white]="activeTab() === 'adicionales'"
          [class.shadow-indigo-600\/20]="activeTab() === 'adicionales'"
          [class.bg-slate-900\/60]="activeTab() !== 'adicionales'"
          [class.text-slate-400]="activeTab() !== 'adicionales'"
          [class.hover:text-white]="activeTab() !== 'adicionales'"
          class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-slate-800/60"
        >
          <svg lucideLayers class="w-4 h-4"></svg>
          <span>Adicionales</span>
        </button>
      </div>

      <!-- TAB 3: ADICIONALES POR PLATILLO -->
      @if (activeTab() === 'adicionales') {
        <app-adicionales-admin [categorias]="categories()" [productos]="products()" [ingredientes]="ingredients()" />
      }

      <!-- TAB 1: PRODUCTS & CATEGORIES MANAGEMENT -->
      @if (activeTab() === 'products') {
        <div class="flex flex-col lg:flex-row gap-8 items-stretch min-h-[600px] animate-fadeIn">
          <!-- Left Sidebar: Categories Management -->
          <aside class="w-full lg:w-80 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md p-6 flex flex-col shrink-0">
            <div class="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
              <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <svg lucideTag class="w-4 h-4"></svg>
                Categorías
              </h2>
              <button aria-label="Nueva Categoría"
                (click)="showCreateCategoryForm()"
                class="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Nueva Categoría"
              >
                <svg lucidePlus class="w-4 h-4"></svg>
              </button>
            </div>

            <!-- Inline Category Form (Create / Edit) -->
            @if (isCategoryFormOpen()) {
              <div class="mb-4 p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-3 animate-fadeIn">
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                  <input aria-label="Nombre de la categoría"
                    type="text"
                    placeholder="Ej: Bebidas, Postres"
                    [(ngModel)]="categoryForm.name"
                    class="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <button
                    (click)="cancelCategoryForm()"
                    class="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    (click)="saveCategory()"
                    [disabled]="!categoryForm.name.trim()"
                    class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ categoryForm.id ? 'Actualizar' : 'Guardar' }}
                  </button>
                </div>
              </div>
            }

            <!-- Categories List -->
            <div class="flex-1 overflow-y-auto space-y-1 max-h-[450px] pr-1">
              @if (isLoading()) {
                <div class="flex justify-center py-8">
                  <svg lucideLoader2 class="animate-spin w-6 h-6 text-indigo-500"></svg>
                </div>
              } @else if (categories().length === 0) {
                <div class="text-center py-8 text-xs text-slate-400">
                  No hay categorías creadas.
                </div>
              } @else {
                @for (cat of categories(); track cat.id) {
                  <div
                    [class.bg-indigo-600\/10]="selectedCategoryId() === cat.id"
                    [class.border-indigo-500\/30]="selectedCategoryId() === cat.id"
                    [class.text-indigo-400]="selectedCategoryId() === cat.id"
                    [class.bg-transparent]="selectedCategoryId() !== cat.id"
                    [class.border-transparent]="selectedCategoryId() !== cat.id"
                    [class.text-slate-400]="selectedCategoryId() !== cat.id"
                    class="flex items-center justify-between px-4 py-3 rounded-xl border hover:bg-slate-800/40 hover:text-white transition-all cursor-pointer group"
                    (click)="selectCategory(cat.id)"
                  >
                    <span class="text-sm font-semibold truncate pr-2">{{ cat.name }}</span>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button aria-label="Editar"
                        (click)="$event.stopPropagation(); editCategory(cat)"
                        class="p-1 text-slate-500 hover:text-white hover:bg-slate-700/80 rounded transition-colors"
                        title="Editar"
                      >
                        <svg lucideEdit class="w-3.5 h-3.5"></svg>
                      </button>
                      <button aria-label="Eliminar"
                        (click)="$event.stopPropagation(); deleteCategoryPrompt(cat.id)"
                        class="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        title="Eliminar"
                      >
                        <svg lucideTrash2 class="w-3.5 h-3.5"></svg>
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          </aside>

          <!-- Right Pane: Products Catalog Area -->
          <main class="flex-1 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md p-6 flex flex-col">
            <!-- Selection Warning -->
            @if (!selectedCategoryId()) {
              <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div class="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <svg lucideTag class="w-8 h-8"></svg>
                </div>
                <div>
                  <h3 class="font-bold text-white text-lg">Catálogo Vacío</h3>
                  <p class="text-xs text-slate-400 mt-1 max-w-sm">Selecciona una categoría de la barra lateral izquierda para ver y gestionar sus productos.</p>
                </div>
              </div>
            } @else {
              <!-- Active Category Header & Search Controls -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5 mb-6">
                <div>
                  @if (soloSinFoto()) {
                    <span class="text-[11px] font-bold text-amber-400 uppercase tracking-widest">Todas las categorías</span>
                    <h2 class="text-xl font-bold text-white mt-0.5">Platillos sin foto</h2>
                  } @else {
                    <span class="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Categoría seleccionada</span>
                    <h2 class="text-xl font-bold text-white mt-0.5">{{ selectedCategory()?.name }}</h2>
                  }
                </div>
                
                <div class="flex flex-wrap items-center gap-3">
                  <!-- Search Box -->
                  <div class="relative w-full sm:w-60">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <svg lucideSearch class="w-4 h-4"></svg>
                    </div>
                    <input aria-label="Buscar producto"
                      type="text"
                      placeholder="Buscar producto..."
                      [value]="searchQuery()"
                      (input)="onSearchChange($event)"
                      class="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <!-- Grid/List View Toggle -->
                  <div class="flex items-center bg-slate-950/50 border border-slate-850 p-1 rounded-xl">
                    <button aria-label="Vista en Cuadrícula"
                      (click)="viewMode.set('grid')"
                      [class.bg-slate-800]="viewMode() === 'grid'"
                      [class.text-white]="viewMode() === 'grid'"
                      [class.text-slate-500]="viewMode() !== 'grid'"
                      class="p-1.5 rounded-lg transition-all cursor-pointer"
                      title="Vista en Cuadrícula"
                    >
                      <svg lucideGrid class="w-4 h-4"></svg>
                    </button>
                    <button aria-label="Vista en Lista"
                      (click)="viewMode.set('list')"
                      [class.bg-slate-800]="viewMode() === 'list'"
                      [class.text-white]="viewMode() === 'list'"
                      [class.text-slate-500]="viewMode() !== 'list'"
                      class="p-1.5 rounded-lg transition-all cursor-pointer"
                      title="Vista en Lista"
                    >
                      <svg lucideList class="w-4 h-4"></svg>
                    </button>
                  </div>

                  <!-- Add Product Button -->
                  <button
                    (click)="showCreateProductModal()"
                    class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 cursor-pointer"
                  >
                    <svg lucidePlus class="w-4 h-4"></svg>
                    <span>Agregar Producto</span>
                  </button>
                  <button
                    (click)="showCreateProductModal(true)"
                    class="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-fuchsia-500/30 text-fuchsia-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <svg lucidePackage class="w-4 h-4"></svg>
                    <span>Nuevo combo</span>
                  </button>
                </div>
              </div>

              <!-- Fotos pendientes: el menú en línea vende más con fotos -->
              @if (products().length > 0 && (sinFotoTotal() > 0 || soloSinFoto())) {
                <div class="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3"
                  [class]="soloSinFoto() ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-900/60'">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-white">
                      @if (sinFotoTotal() === 0) {
                        Todos los platillos tienen foto.
                      } @else {
                        {{ sinFotoTotal() }} de {{ products().length }} platillos sin foto
                      }
                    </p>
                    <div class="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
                      <div class="h-full bg-emerald-500 rounded-full transition-all"
                        [style.width.%]="(products().length - sinFotoTotal()) / products().length * 100"></div>
                    </div>
                    <p class="text-xs text-slate-400 mt-1.5">Los platillos con foto se venden más en el menú en línea.</p>
                  </div>
                  <button
                    (click)="soloSinFoto.set(!soloSinFoto())"
                    [attr.aria-pressed]="soloSinFoto()"
                    class="shrink-0 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    [class]="soloSinFoto() ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'"
                  >
                    {{ soloSinFoto() ? 'Volver a las categorías' : 'Ver los que no tienen foto' }}
                  </button>
                </div>
              }

              <!-- Products View -->
              <div class="flex-1">
                @if (filteredProducts().length === 0) {
                  <div class="py-16 text-center border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <svg lucideAlertCircle class="w-10 h-10 text-slate-600"></svg>
                    <h3 class="font-bold text-white text-sm">No se encontraron productos</h3>
                    <p class="text-xs text-slate-400 max-w-xs">No hay productos registrados en esta categoría o no coinciden con la búsqueda.</p>
                  </div>
                } @else {
                  <!-- Grid View -->
                  @if (viewMode() === 'grid') {
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-fadeIn">
                      @for (prod of filteredProducts(); track prod.id) {
                        <div class="bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative group transition-all duration-200">
                          <!-- Foto: es lo primero que ve el cliente en el menú en línea -->
                          <input #inputFoto type="file" accept="image/*" class="hidden" (change)="alElegirFoto(prod.id, $event)" />
                          @if (fotoDe(prod.id); as src) {
                            <div class="relative -mx-5 -mt-5 mb-4 aspect-[4/3] rounded-t-2xl overflow-hidden bg-slate-950">
                              <img [src]="src" [alt]="prod.name" loading="lazy" class="w-full h-full object-cover" />
                              <div class="absolute bottom-2 right-2 flex gap-1.5">
                                <button (click)="inputFoto.click()" [disabled]="subiendoFoto() === prod.id"
                                  class="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-white text-[11px] font-bold backdrop-blur cursor-pointer disabled:opacity-60">
                                  {{ subiendoFoto() === prod.id ? 'Subiendo...' : 'Cambiar' }}
                                </button>
                                <button (click)="quitarFoto(prod.id)" [attr.aria-label]="'Quitar la foto de ' + prod.name"
                                  class="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-rose-600 text-white text-[11px] font-bold backdrop-blur cursor-pointer">
                                  Quitar
                                </button>
                              </div>
                            </div>
                          } @else {
                            <button (click)="inputFoto.click()" [disabled]="subiendoFoto() === prod.id"
                              class="-mx-5 -mt-5 mb-4 h-24 rounded-t-2xl border-b border-dashed border-slate-700 bg-slate-950/40 hover:bg-slate-900/60 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-slate-300 text-xs font-semibold cursor-pointer transition-colors disabled:cursor-wait">
                              <svg lucidePlus class="w-5 h-5"></svg>
                              {{ subiendoFoto() === prod.id ? 'Subiendo foto...' : 'Agregar foto' }}
                            </button>
                          }
                          <div class="space-y-2">
                            <div class="space-y-1.5">
                              <h4 class="font-bold text-white text-base leading-snug line-clamp-2" [title]="prod.name">{{ prod.name }}</h4>
                              <span class="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-black text-indigo-400 inline-block">
                                {{ prod.price | pesos }}
                              </span>
                            </div>
                            <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">{{ prod.description || 'Sin descripción' }}</p>
                            @if (prod.isCombo && prod.comboItems?.length) {
                              <p class="text-xs text-slate-300 leading-relaxed">
                                <span class="text-slate-500">Incluye:</span> {{ textoIncluye(prod) }}
                                @if (ahorroDe(prod); as ahorro) {
                                  <span class="block text-emerald-400 font-semibold mt-0.5">Ahorra {{ ahorro | pesos }} contra pedirlo por separado</span>
                                }
                              </p>
                            }
                          </div>

                          <!-- Recipe & Inventory Badges (Requirement 4) -->
                          <div class="mt-3 flex flex-wrap items-center gap-1.5">
                            @if (activeBranchId() && prod.active) {
                              <button type="button" (click)="alternarAgotado(prod)"
                                class="px-2 py-0.5 rounded-md border text-[11px] font-bold cursor-pointer"
                                [class]="prod.agotadoHoy ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'"
                                [title]="prod.agotadoHoy ? 'Volver a ofrecerlo hoy' : 'Deja de ofrecerse hoy en el menú, el bot y con los meseros'">
                                {{ prod.agotadoHoy ? 'Se acabó hoy · Ya hay' : 'Se acabó' }}
                              </button>
                            } @else if (prod.agotado) {
                              <span class="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-bold">Agotado</span>
                            }
                            @if (prod.isCombo) {
                              <span class="px-2 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <svg lucidePackage class="w-3 h-3"></svg> Combo
                              </span>
                              @if (prod.vigencia) {
                                <span class="px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide"
                                  [class]="prod.vigenteHoy ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' : 'bg-slate-800/80 border-slate-700/60 text-slate-400'"
                                  [title]="prod.vigenteHoy ? 'Se vende hoy' : 'Hoy no aparece en el menú ni en el panel de meseros'">
                                  {{ prod.vigenteHoy ? '' : 'Hoy no · ' }}{{ prod.vigencia }}
                                </span>
                              }
                              @if (activeBranchId() && prod.stock !== null && prod.stock !== undefined) {
                                <span class="px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider"
                                  [class]="prod.stock > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'">
                                  {{ prod.stock > 0 ? 'Alcanzan: ' + prod.stock : 'Sin existencias' }}
                                </span>
                              }
                            }
                            @if (prod.isRecipe) {
                              <span class="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <svg lucideChefHat class="w-3 h-3"></svg> Receta
                              </span>
                            }

                            @if (prod.trackStock || prod.isRecipe) {
                              @if (!activeBranchId() || prod.stock === null || prod.stock === undefined) {
                                <span class="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1" title="Selecciona una sucursal para ver el inventario">
                                  <svg lucideAlertCircle class="w-3 h-3"></svg> Selecciona una sucursal para ver stock
                                </span>
                              } @else if (prod.stock > 0) {
                                <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <svg lucideBoxes class="w-3 h-3"></svg> Stock: {{ prod.stock }}
                                </span>
                              } @else {
                                <span class="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <svg lucideAlertCircle class="w-3 h-3"></svg> Stock: {{ prod.stock }} (Sin Stock)
                                </span>
                              }
                            }

                            @if (prod.isRecipe && activeBranchId() && prod.stock !== null && prod.stock !== undefined) {
                              <button
                                type="button"
                                (click)="toggleRecipeBreakdown(prod.id)"
                                class="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <svg lucideLayers class="w-3 h-3 text-amber-400"></svg>
                                <span>{{ isRecipeBreakdownExpanded(prod.id) ? 'Ocultar desglose' : 'Ver desglose de materia prima' }}</span>
                                @if (isRecipeBreakdownExpanded(prod.id)) {
                                  <svg lucideChevronUp class="w-3 h-3 text-amber-400"></svg>
                                } @else {
                                  <svg lucideChevronDown class="w-3 h-3 text-amber-400"></svg>
                                }
                              </button>
                            }
                          </div>

                          <!-- Desglose de Materia Prima Desplegable (Grid) -->
                          @if (prod.isRecipe && activeBranchId() && prod.stock !== null && prod.stock !== undefined && isRecipeBreakdownExpanded(prod.id)) {
                            <div class="mt-3 p-3 rounded-xl bg-slate-955/90 border border-slate-800/80 space-y-2 animate-fadeIn shadow-inner">
                              <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                                <span class="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                  <svg lucideChefHat class="w-3 h-3"></svg> Materia Prima Proyectada
                                </span>
                                <span class="text-[11px] text-slate-400 font-mono">
                                  Lote Máx: {{ prod.stock }}
                                </span>
                              </div>

                              <div class="space-y-1.5">
                                @if (!prod.recipeItems || prod.recipeItems.length === 0) {
                                  <p class="text-[11px] text-slate-500 italic py-1 text-center">Sin ingredientes configurados.</p>
                                } @else {
                                  @for (item of getRecipeBreakdown(prod); track item.ingredientId) {
                                    <div 
                                      [class.bg-amber-500\/10]="item.isBottleneck"
                                      [class.border-amber-500\/30]="item.isBottleneck"
                                      [class.bg-slate-900\/60]="!item.isBottleneck"
                                      [class.border-slate-800\/60]="!item.isBottleneck"
                                      class="p-2 rounded-lg border flex flex-col gap-1 text-[11px] transition-colors"
                                    >
                                      <div class="flex items-center justify-between gap-1">
                                        <span class="font-bold text-white truncate">{{ item.name }}</span>
                                        @if (item.isBottleneck) {
                                          <span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-0.5" title="Ingrediente limitante / cuello de botella">
                                            <svg lucideAlertCircle class="w-2.5 h-2.5"></svg> Limitante
                                          </span>
                                        }
                                      </div>
                                      <div class="text-[11px] text-slate-300 font-mono flex items-center justify-between">
                                        <span [class.text-amber-300]="item.isBottleneck" [class.font-bold]="item.isBottleneck">
                                          {{ formatQuantity(item.requiredTotal) }} {{ item.unitOfMeasure }}
                                        </span>
                                        <span class="text-slate-400">
                                          de {{ formatQuantity(item.availableStock) }} {{ item.unitOfMeasure }} dispon.
                                        </span>
                                      </div>
                                    </div>
                                  }
                                }
                              </div>
                            </div>
                          }

                          <div class="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between">
                            <span 
                              [class.bg-emerald-500/10]="prod.active"
                              [class.text-emerald-400]="prod.active"
                              [class.border-emerald-500/20]="prod.active"
                              [class.bg-slate-800/50]="!prod.active"
                              [class.text-slate-500]="!prod.active"
                              [class.border-slate-700/30]="!prod.active"
                              class="px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider"
                            >
                              {{ prod.active ? 'Activo' : 'Inactivo' }}
                            </span>
                            
                            <div class="flex items-center gap-1">
                              @if (prod.trackStock || prod.isRecipe) {
                                <button
                                  (click)="openAdjustStockModal('PRODUCT', prod)"
                                  [disabled]="prod.isRecipe"
                                  [title]="prod.isRecipe ? 'El stock de los preparados se ajusta modificando la cantidad de sus ingredientes' : 'Ajustar stock físico'"
                                  class="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sky-500/10"
                                >
                                  <svg lucideBoxes class="w-3 h-3"></svg>
                                  <span>Ajustar</span>
                                </button>
                              }
                              
                              <button aria-label="Editar"
                                (click)="editProduct(prod)"
                                class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <svg lucideEdit class="w-3.5 h-3.5"></svg>
                              </button>
                              <button aria-label="Eliminar"
                                (click)="deleteProductPrompt(prod.id)"
                                class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <svg lucideTrash2 class="w-3.5 h-3.5"></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <!-- List View -->
                    <div class="divide-y divide-slate-800/60 border border-slate-800/60 rounded-2xl bg-slate-900/10 overflow-hidden animate-fadeIn">
                      @for (prod of filteredProducts(); track prod.id) {
                        <div class="flex flex-col p-4 hover:bg-slate-800/20 transition-colors group gap-2">
                          <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4 flex-1 min-w-0 pr-4">
                              <div class="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 border border-slate-800/50 shrink-0 overflow-hidden">
                                @if (fotoDe(prod.id); as src) {
                                  <img [src]="src" [alt]="prod.name" loading="lazy" class="w-full h-full object-cover" />
                                } @else {
                                {{ prod.name.charAt(0).toUpperCase() }}
                                }
                              </div>
                              <div class="min-w-0 space-y-0.5">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <h4 class="font-bold text-white text-sm truncate">{{ prod.name }}</h4>
                                  @if (prod.isRecipe) {
                                    <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase">
                                      Receta
                                    </span>
                                  }
                                  @if (prod.isCombo) {
                                    <span class="px-1.5 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[10px] font-bold uppercase">
                                      Combo
                                    </span>
                                    @if (prod.vigencia) {
                                      <span class="px-1.5 py-0.5 rounded border text-[10px] font-bold"
                                        [class]="prod.vigenteHoy ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' : 'bg-slate-800 border-slate-700 text-slate-400'">
                                        {{ prod.vigenteHoy ? '' : 'Hoy no · ' }}{{ prod.vigencia }}
                                      </span>
                                    }
                                    @if (activeBranchId() && prod.stock !== null && prod.stock !== undefined) {
                                      <span class="px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase"
                                        [class]="prod.stock > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'">
                                        {{ prod.stock > 0 ? 'Alcanzan: ' + prod.stock : 'Sin existencias' }}
                                      </span>
                                    }
                                  }
                                  
                                  @if (prod.trackStock || prod.isRecipe) {
                                    @if (!activeBranchId() || prod.stock === null || prod.stock === undefined) {
                                      <span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase">
                                        Selecciona una sucursal para ver stock
                                      </span>
                                    } @else if (prod.stock > 0) {
                                      <span class="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                                        Stock: {{ prod.stock }}
                                      </span>
                                    } @else {
                                      <span class="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">
                                        Stock: {{ prod.stock }} (Sin stock)
                                      </span>
                                    }
                                  }

                                  @if (prod.isRecipe && activeBranchId() && prod.stock !== null && prod.stock !== undefined) {
                                    <button
                                      type="button"
                                      (click)="toggleRecipeBreakdown(prod.id)"
                                      class="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <svg lucideLayers class="w-3 h-3 text-amber-400"></svg>
                                      <span>{{ isRecipeBreakdownExpanded(prod.id) ? 'Ocultar desglose' : 'Ver desglose de materia prima' }}</span>
                                      @if (isRecipeBreakdownExpanded(prod.id)) {
                                        <svg lucideChevronUp class="w-3 h-3 text-amber-400"></svg>
                                      } @else {
                                        <svg lucideChevronDown class="w-3 h-3 text-amber-400"></svg>
                                      }
                                    </button>
                                  }
                                </div>
                                <p class="text-xs text-slate-400 truncate max-w-lg">{{ prod.isCombo && prod.comboItems?.length ? 'Incluye: ' + textoIncluye(prod) : (prod.description || 'Sin descripción') }}</p>
                              </div>
                            </div>

                            <div class="flex items-center gap-4 shrink-0">
                              <span class="text-xs font-bold text-white bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                                {{ prod.price | pesos }}
                              </span>
                              
                              <span 
                                [class.bg-emerald-500/10]="prod.active"
                                [class.text-emerald-400]="prod.active"
                                [class.border-emerald-500/20]="prod.active"
                                [class.bg-slate-800/50]="!prod.active"
                                [class.text-slate-500]="!prod.active"
                                [class.border-slate-700/30]="!prod.active"
                                class="px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider hidden sm:inline"
                              >
                                {{ prod.active ? 'Activo' : 'Inactivo' }}
                              </span>

                              <div class="flex items-center gap-1">
                                @if (prod.trackStock || prod.isRecipe) {
                                  <button
                                    (click)="openAdjustStockModal('PRODUCT', prod)"
                                    [disabled]="prod.isRecipe"
                                    [title]="prod.isRecipe ? 'El stock de los preparados se ajusta modificando la cantidad de sus ingredientes' : 'Ajustar stock físico'"
                                    class="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sky-500/10"
                                  >
                                    <svg lucideBoxes class="w-3.5 h-3.5"></svg>
                                    <span>Ajustar Stock</span>
                                  </button>
                                }

                                <button aria-label="Editar"
                                  (click)="editProduct(prod)"
                                  class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <svg lucideEdit class="w-3.5 h-3.5"></svg>
                                </button>
                                <button aria-label="Eliminar"
                                  (click)="deleteProductPrompt(prod.id)"
                                  class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <svg lucideTrash2 class="w-3.5 h-3.5"></svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          <!-- Desglose desplegable (List View) -->
                          @if (prod.isRecipe && activeBranchId() && prod.stock !== null && prod.stock !== undefined && isRecipeBreakdownExpanded(prod.id)) {
                            <div class="mt-2 p-3 rounded-xl bg-slate-955/90 border border-slate-800/80 space-y-2 animate-fadeIn shadow-inner">
                              <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                                <span class="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                  <svg lucideChefHat class="w-3 h-3"></svg> Desglose de Materia Prima Proyectada (Lote Máximo: {{ prod.stock }} {{ prod.stock === 1 ? 'unidad' : 'unidades' }})
                                </span>
                              </div>

                              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                @if (!prod.recipeItems || prod.recipeItems.length === 0) {
                                  <p class="text-[11px] text-slate-500 italic py-1 col-span-full">Sin ingredientes configurados en la receta.</p>
                                } @else {
                                  @for (item of getRecipeBreakdown(prod); track item.ingredientId) {
                                    <div 
                                      [class.bg-amber-500\/10]="item.isBottleneck"
                                      [class.border-amber-500\/30]="item.isBottleneck"
                                      [class.bg-slate-900\/60]="!item.isBottleneck"
                                      [class.border-slate-800\/60]="!item.isBottleneck"
                                      class="p-2.5 rounded-lg border flex flex-col justify-between gap-1 text-[11px] transition-colors"
                                    >
                                      <div class="flex items-center justify-between gap-1">
                                        <span class="font-bold text-white truncate">{{ item.name }}</span>
                                        @if (item.isBottleneck) {
                                          <span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-0.5" title="Ingrediente limitante / cuello de botella">
                                            <svg lucideAlertCircle class="w-2.5 h-2.5"></svg> Limitante
                                          </span>
                                        }
                                      </div>
                                      <div class="text-[11px] text-slate-300 font-mono flex items-center justify-between mt-1">
                                        <span [class.text-amber-300]="item.isBottleneck" [class.font-bold]="item.isBottleneck">
                                          Requerido: {{ formatQuantity(item.requiredTotal) }} {{ item.unitOfMeasure }}
                                        </span>
                                        <span class="text-slate-400">
                                          de {{ formatQuantity(item.availableStock) }} {{ item.unitOfMeasure }} dispon.
                                        </span>
                                      </div>
                                    </div>
                                  }
                                }
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            }
          </main>
        </div>
      }

      <!-- TAB 2: INGREDIENTS (MATERIA PRIMA) MANAGEMENT -->
      @if (activeTab() === 'ingredients') {
        <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md p-6 animate-fadeIn space-y-6">
          <div class="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
            <div>
              <span class="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Inventario de Materia Prima</span>
              <h2 class="text-xl font-bold text-white mt-0.5">Ingredientes y Stock en Sucursal</h2>
              <p class="text-xs text-slate-400 mt-1">Registra lo que llega, lo que se tira y lo que cuentas: cada cambio queda en el historial.</p>
            </div>
            
            <div class="flex flex-wrap items-center gap-3">
              <div class="relative w-full sm:w-60 shrink-0">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg lucideSearch class="w-4 h-4"></svg>
                </div>
                <input aria-label="Buscar ingrediente"
                  type="text"
                  placeholder="Buscar ingrediente..."
                  [value]="ingredientSearchQuery()"
                  (input)="ingredientSearchQuery.set($any($event.target).value)"
                  class="w-full pl-10 pr-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div class="inline-flex p-1 bg-slate-950/60 border border-slate-800 rounded-xl shrink-0" role="group" aria-label="Filtrar ingredientes">
                <button type="button" (click)="filtroExistencias.set('todos')" [attr.aria-pressed]="filtroExistencias() === 'todos'"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  [class]="filtroExistencias() === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'">
                  Todos
                </button>
                <button type="button" (click)="filtroExistencias.set('bajo')" [attr.aria-pressed]="filtroExistencias() === 'bajo'"
                  [disabled]="!activeBranchId()"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  [class]="filtroExistencias() === 'bajo' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'">
                  Bajo mínimo · {{ bajoMinimo() }}
                </button>
                <button type="button" (click)="filtroExistencias.set('sin')" [attr.aria-pressed]="filtroExistencias() === 'sin'"
                  [disabled]="!activeBranchId()"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  [class]="filtroExistencias() === 'sin' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'">
                  Sin existencias · {{ sinExistencias() }}
                </button>
              </div>

              <label class="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer shrink-0">
                <input type="checkbox" [checked]="verDesactivados()" (change)="verDesactivados.set($any($event.target).checked)" class="accent-indigo-500" />
                Ver desactivados
              </label>

              <button
                (click)="showCreateIngredientModal()"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 cursor-pointer shrink-0"
              >
                <svg lucidePlus class="w-4 h-4"></svg>
                <span>Agregar Ingrediente</span>
              </button>
            </div>
          </div>

          <app-control-inventario [branchId]="activeBranchId()" />

          <!-- Ingredients Table -->
          <div class="overflow-x-auto border border-slate-800/80 rounded-2xl bg-slate-955/30">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-900/80 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th class="py-3.5 px-5">Nombre del Ingrediente</th>
                  <th class="py-3.5 px-5">Unidad de Medida</th>
                  <th class="py-3.5 px-5">Stock en Sucursal</th>
                  <th class="py-3.5 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-xs">
                @if (isLoading()) {
                  <tr>
                    <td colspan="4" class="py-12 text-center">
                      <svg lucideLoader2 class="animate-spin w-6 h-6 text-indigo-500 mx-auto"></svg>
                    </td>
                  </tr>
                } @else if (filteredIngredients().length === 0) {
                  <tr>
                    <td colspan="4" class="py-12 text-center text-slate-500">
                      No hay ingredientes registrados.
                    </td>
                  </tr>
                } @else {
                  @for (ing of filteredIngredients(); track ing.id) {
                    <tr class="hover:bg-slate-800/30 transition-colors group">
                      <td class="py-4 px-5 font-semibold text-white">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <svg lucideBoxes class="w-4 h-4"></svg>
                          </div>
                          <span class="min-w-0">
                            <span class="block" [class.text-slate-500]="ing.active === false">{{ ing.name }}</span>
                            <span class="block text-[11px] font-normal text-slate-500">
                              @if (ing.active === false) { <span class="text-amber-400">Desactivado · </span> }
                              {{ ing.usos ? 'En ' + ing.usos + (ing.usos === 1 ? ' platillo' : ' platillos') : 'Sin recetas' }}
                              @if (ing.minimo) { · mín. {{ cantidadLegible(ing.minimo, ing.unitOfMeasure) }} }
                            </span>
                          </span>
                        </div>
                      </td>
                      <td class="py-4 px-5 font-mono text-slate-300">
                        <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-indigo-300 font-bold uppercase text-[11px]">
                          {{ ing.unitOfMeasure }}
                        </span>
                      </td>
                      <td class="py-4 px-5 font-bold">
                        @if (!activeBranchId() || ing.stock === null || ing.stock === undefined) {
                          <span class="text-slate-400 text-xs italic">
                            Selecciona una sucursal para ver stock
                          </span>
                        } @else if (ing.stock < 0) {
                          <span class="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm tabular-nums" title="Se vendió más de lo registrado: haz un conteo">
                            {{ cantidadLegible(ing.stock, ing.unitOfMeasure) }} · negativo
                          </span>
                        } @else if (ing.stock > 0 && ing.minimo && ing.stock < ing.minimo) {
                          <span class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm tabular-nums">
                            {{ cantidadLegible(ing.stock, ing.unitOfMeasure) }} · queda poco
                          </span>
                        } @else if (ing.stock > 0) {
                          <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm tabular-nums">
                            {{ cantidadLegible(ing.stock, ing.unitOfMeasure) }}
                          </span>
                        } @else {
                          <span class="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                            Sin existencias
                          </span>
                        }
                      </td>
                      <td class="py-4 px-5 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button
                            (click)="openAdjustStockModal('INGREDIENT', ing)"
                            class="px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Entrada, merma o conteo"
                          >
                            <svg lucideBoxes class="w-3.5 h-3.5"></svg>
                            <span>Movimiento</span>
                          </button>
                          <button
                            (click)="verHistorial(ing)"
                            [disabled]="!activeBranchId()"
                            class="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40"
                          >
                            Historial
                          </button>
                          <button
                            (click)="alternarActivo(ing)"
                            class="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
                            [title]="ing.active === false ? 'Volver a ofrecerlo en las recetas' : 'Dejar de ofrecerlo en las recetas; conserva su historial'"
                          >
                            {{ ing.active === false ? 'Activar' : 'Desactivar' }}
                          </button>

                          <button aria-label="Editar"
                            (click)="editIngredient(ing)"
                            class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <svg lucideEdit class="w-4 h-4"></svg>
                          </button>
                          <button aria-label="Eliminar"
                            (click)="deleteIngredientPrompt(ing.id)"
                            class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <svg lucideTrash2 class="w-4 h-4"></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Product Modal (Create/Edit) -->
    @if (isProductModalOpen()) {
      <div class="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div (click)="closeProductModal()" class="absolute inset-0 bg-slate-955/70 backdrop-blur-sm transition-opacity duration-300"></div>

        <!-- Dialog Body -->
        <div class="w-full max-w-xl bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl relative overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
          <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0">
            <h3 class="text-base font-bold text-white">
              {{ productForm.isCombo ? (productForm.id ? 'Editar combo' : 'Nuevo combo') : (productForm.id ? 'Editar Producto' : 'Crear Producto') }}
            </h3>
            <button aria-label="Cerrar"
              (click)="closeProductModal()"
              class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <div class="p-6 space-y-5 overflow-y-auto">
            <!-- ¿Platillo o combo? -->
            <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-955 border border-slate-800" role="radiogroup" aria-label="Tipo de producto">
              <button type="button" role="radio" [attr.aria-checked]="!productForm.isCombo" (click)="productForm.isCombo = false"
                class="py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                [class]="!productForm.isCombo ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
                Platillo o bebida
              </button>
              <button type="button" role="radio" [attr.aria-checked]="productForm.isCombo" (click)="volverCombo()"
                class="py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                [class]="productForm.isCombo ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-white'">
                Combo o paquete
              </button>
            </div>

            <!-- Name & Price -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="sm:col-span-2">
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
                <input aria-label="Nombre del producto"
                  type="text"
                  [placeholder]="productForm.isCombo ? 'Ej. Combo pareja, Martes de tacos' : 'Nombre del plato o bebida'"
                  [(ngModel)]="productForm.name"
                  class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{{ productForm.isCombo ? 'Precio del combo ($)' : 'Precio ($)' }}</label>
                <input aria-label="Precio"
                  type="number"
                  step="0.01"
                  placeholder="10.00"
                  [(ngModel)]="productForm.price"
                  class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <!-- Categoría: en qué parte del menú aparece -->
            <div>
              <label for="prod-categoria" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Categoría</label>
              <select id="prod-categoria" [(ngModel)]="productForm.categoryId"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer [color-scheme:dark]">
                <option value="" disabled class="bg-slate-900 text-slate-400">Elige una categoría</option>
                @for (cat of categories(); track cat.id) {
                  <option [value]="cat.id" class="bg-slate-900 text-white">{{ cat.name }}{{ cat.active ? '' : ' (oculta)' }}</option>
                }
              </select>
              @if (productForm.isCombo && !hayCategoriaDeCombos()) {
                <p class="text-[11px] text-slate-500 mt-1.5">Consejo: crea una categoría «Combos» o «Paquetes» para que aparezcan juntos en el menú.</p>
              }
            </div>

            <!-- Description -->
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descripción</label>
              <textarea aria-label="Descripción"
                rows="2"
                placeholder="Ingredientes o detalles del producto"
                [(ngModel)]="productForm.description"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors resize-none"
              ></textarea>
            </div>

            <!-- Active Checkbox -->
            <div class="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                id="prod-active"
                [(ngModel)]="productForm.active"
                class="w-4 h-4 accent-indigo-600 cursor-pointer"
              />
              <label for="prod-active" class="text-xs font-semibold text-slate-300 cursor-pointer">Producto Disponible / Activo</label>
            </div>

            @if (productForm.isCombo) {
              <!-- QUÉ INCLUYE EL COMBO -->
              <div class="p-4 rounded-xl bg-slate-955/60 border border-fuchsia-500/20 space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-2">
                    <svg lucidePackage class="w-4 h-4"></svg>
                    Qué incluye
                  </h4>
                  <button type="button" (click)="agregarAlCombo()" [disabled]="platillosParaCombo().length === 0"
                    class="px-2.5 py-1 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/20 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg lucidePlus class="w-3.5 h-3.5"></svg>
                    <span>Agregar platillo</span>
                  </button>
                </div>

                @if (productForm.comboItems.length === 0) {
                  <p class="p-4 text-center border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs">
                    Agrega los platillos que trae el combo. Pueden ser varios del mismo: 4 tacos, 2 refrescos.
                  </p>
                } @else {
                  <div class="space-y-2">
                    @for (parte of productForm.comboItems; track $index) {
                      <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <input aria-label="Cantidad" type="number" min="1" max="50" step="1"
                          [(ngModel)]="parte.cantidad"
                          class="w-16 bg-slate-955 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-white text-center tabular-nums outline-none focus:border-fuchsia-500 shrink-0" />
                        <span class="text-slate-500 text-xs shrink-0">×</span>
                        <select aria-label="Platillo" [(ngModel)]="parte.productId"
                          class="flex-1 min-w-0 bg-slate-955 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-fuchsia-500 cursor-pointer [color-scheme:dark]">
                          <option value="" disabled class="bg-slate-900 text-slate-400">Elige un platillo</option>
                          @for (grupo of platillosParaCombo(); track grupo.categoria) {
                            <optgroup [label]="grupo.categoria" class="bg-slate-900 text-slate-400">
                              @for (p of grupo.platillos; track p.id) {
                                <option [value]="p.id" class="bg-slate-900 text-white">{{ p.name }} — {{ p.price | pesos }}{{ p.active ? '' : ' (desactivado)' }}</option>
                              }
                            </optgroup>
                          }
                        </select>
                        <button type="button" aria-label="Quitar del combo" (click)="productForm.comboItems.splice($index, 1)"
                          class="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer shrink-0">
                          <svg lucideX class="w-4 h-4"></svg>
                        </button>
                      </div>
                    }
                  </div>

                  <!-- Cuánto ahorra el cliente -->
                  <dl class="grid grid-cols-3 gap-2 text-center">
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <dt class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Por separado</dt>
                      <dd class="text-sm font-bold text-slate-300 tabular-nums">{{ precioNormalForm() | pesos }}</dd>
                    </div>
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <dt class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Combo</dt>
                      <dd class="text-sm font-bold text-white tabular-nums">{{ (productForm.price || 0) | pesos }}</dd>
                    </div>
                    <div class="p-2 rounded-lg border"
                      [class]="ahorroForm() > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'">
                      <dt class="text-[10px] font-bold uppercase tracking-wider" [class]="ahorroForm() > 0 ? 'text-emerald-400' : 'text-amber-400'">Ahorro</dt>
                      <dd class="text-sm font-bold tabular-nums" [class]="ahorroForm() > 0 ? 'text-emerald-300' : 'text-amber-300'">
                        {{ ahorroForm() > 0 ? (ahorroForm() | pesos) + ' (' + porcentajeAhorroForm() + '%)' : 'Ninguno' }}
                      </dd>
                    </div>
                  </dl>
                  @if (ahorroForm() <= 0 && productForm.price > 0) {
                    <p class="text-[11px] text-amber-400">El combo cuesta lo mismo o más que pedir sus platillos por separado.</p>
                  }
                }
                <p class="text-[11px] text-slate-500">Al venderse descuenta del inventario lo de cada platillo, y en cocina se ve lo que incluye.</p>
              </div>

              <!-- CUÁNDO SE VENDE -->
              <div class="p-4 rounded-xl bg-slate-955/60 border border-slate-800 space-y-3">
                <div>
                  <h4 class="text-xs font-bold text-sky-300 uppercase tracking-wider">Cuándo se vende</h4>
                  <p class="text-[11px] text-slate-400 mt-0.5">Opcional. Fuera de estos días no aparece en el menú en línea, en el bot ni en el panel de meseros.</p>
                </div>
                <div role="group" aria-label="Días de la semana" class="flex flex-wrap gap-1.5">
                  @for (d of diasSemana; track d.valor) {
                    <button type="button" (click)="alternarDia(d.valor)" [attr.aria-pressed]="productForm.promoDias.includes(d.valor)" [title]="d.nombre"
                      class="w-10 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
                      [class]="productForm.promoDias.includes(d.valor) ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'">
                      {{ d.corto }}
                    </button>
                  }
                </div>
                <p class="text-[11px] text-slate-500">{{ productForm.promoDias.length === 0 ? 'Todos los días.' : 'Solo ' + diasElegidosTexto() + '.' }}</p>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="promo-desde" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Desde</label>
                    <input id="promo-desde" type="date" [(ngModel)]="productForm.promoDesde"
                      class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-sky-500 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label for="promo-hasta" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hasta</label>
                    <input id="promo-hasta" type="date" [(ngModel)]="productForm.promoHasta" [min]="productForm.promoDesde || null"
                      class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-sky-500 [color-scheme:dark]" />
                  </div>
                </div>
              </div>
            } @else {
            <!-- INVENTORY & RECIPE CONFIGURATION SECTION -->
            <div class="p-4 rounded-xl bg-slate-955/60 border border-slate-800 space-y-4">
              <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <svg lucideBoxes class="w-4 h-4"></svg>
                Configuración de Inventario & Receta
              </h4>

              <!-- Toggle switch: ¿Es un producto preparado/receta? (isRecipe) -->
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div class="space-y-0.5">
                  <span class="text-xs font-bold text-white block">¿Es un producto preparado/receta?</span>
                  <span class="text-[11px] text-slate-400 block">Elaborado en cocina a partir de materias primas e ingredientes</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    [(ngModel)]="productForm.isRecipe"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <!-- IF isRecipe ES FALSO -->
              @if (!productForm.isRecipe) {
                <div class="space-y-3 pt-1 animate-fadeIn">
                  <!-- Toggle Controlar Inventario (trackStock) -->
                  <div class="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/60">
                    <div class="space-y-0.5">
                      <span class="text-xs font-semibold text-slate-200 block">Controlar Inventario</span>
                      <span class="text-[11px] text-slate-400 block">Ideal para productos terminados como refrescos, cervezas o postres envasados</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="productForm.trackStock"
                        class="sr-only peer"
                      />
                      <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>
                </div>
              }

              <!-- IF isRecipe ES VERDADERO: Receta -->
              @if (productForm.isRecipe) {
                <div class="space-y-3 pt-1 animate-fadeIn">
                  <div class="flex items-center justify-between">
                    <h5 class="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg lucideChefHat class="w-4 h-4"></svg>
                      Fórmula de Receta
                    </h5>
                    <button
                      type="button"
                      (click)="addRecipeItem()"
                      class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <svg lucidePlus class="w-3.5 h-3.5"></svg>
                      <span>Agregar Ingrediente</span>
                    </button>
                  </div>

                  @if (productForm.recipeItems.length === 0) {
                    <div class="p-4 text-center border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs">
                      No se han añadido ingredientes a esta receta. Haz clic en '+ Agregar Ingrediente'.
                    </div>
                  } @else {
                    <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                      @for (item of productForm.recipeItems; track $index) {
                        <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <!-- Select Ingredient -->
                          <select aria-label="Ingrediente"
                            [(ngModel)]="item.ingredientId"
                            (change)="onRecipeIngredientChange(item)"
                            class="flex-1 bg-slate-955 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer min-w-0"
                          >
                            <option value="" disabled class="bg-slate-950 text-slate-400">Selecciona ingrediente</option>
                            @for (ing of ingredientesParaReceta(item.ingredientId); track ing.id) {
                              <option [value]="ing.id" class="bg-slate-950 text-white">
                                {{ ing.name }} ({{ ing.unitOfMeasure }})
                              </option>
                            }
                          </select>

                          <!-- Quantity required for 1 serving -->
                          <div class="w-24 relative shrink-0">
                            <input aria-label="Cantidad"
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="Cant."
                              [(ngModel)]="item.quantity"
                              class="w-full bg-slate-955 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-indigo-500"
                            />
                          </div>

                          <!-- Dynamic Unit Selector -->
                          <select aria-label="Unidad"
                            [(ngModel)]="item.recipeUnit"
                            class="w-20 bg-slate-955 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-amber-300 font-semibold outline-none focus:border-indigo-500 cursor-pointer shrink-0"
                            title="Unidad de medida en la receta"
                          >
                            @for (unitOpt of getAvailableUnitsForItem(item); track unitOpt) {
                              <option [value]="unitOpt" class="bg-slate-950 text-white font-normal">
                                {{ unitOpt }}
                              </option>
                            }
                          </select>

                          <!-- Delete Row Button -->
                          <button aria-label="Quitar ingrediente"
                            type="button"
                            (click)="removeRecipeItem($index)"
                            class="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Quitar ingrediente"
                          >
                            <svg lucideX class="w-4 h-4"></svg>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            }
          </div>

          <div class="p-6 border-t border-slate-800/80 bg-slate-900/40 shrink-0 flex items-center justify-end gap-3">
            @if (faltaParaGuardar(); as falta) {
              <p class="mr-auto text-[11px] text-amber-400" role="status">{{ falta }}</p>
            }
            <button
              (click)="closeProductModal()"
              class="px-4 py-2 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="saveProduct()"
              [disabled]="faltaParaGuardar() !== null"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/25 cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Ingredient Modal (Create/Edit) -->
    @if (isIngredientModalOpen()) {
      <div class="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div (click)="closeIngredientModal()" class="absolute inset-0 bg-slate-955/70 backdrop-blur-sm transition-opacity duration-300"></div>

        <!-- Dialog Body -->
        <div class="w-full max-w-md bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl relative overflow-hidden animate-scaleIn flex flex-col">
          <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0">
            <h3 class="text-base font-bold text-white">
              {{ ingredientForm.id ? 'Editar Ingrediente' : 'Crear Ingrediente' }}
            </h3>
            <button aria-label="Cerrar"
              (click)="closeIngredientModal()"
              class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre del Ingrediente</label>
              <input aria-label="Nombre del ingrediente"
                type="text"
                placeholder="Ej: Carne Sirloin, Queso Gouda, Tomate"
                [(ngModel)]="ingredientForm.name"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Unidad de Medida</label>
              <select aria-label="Unidad de medida"
                [(ngModel)]="ingredientForm.unitOfMeasure"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                @for (u of unidadesDeInventario; track u.valor) {
                  <option [value]="u.valor" class="bg-slate-950 text-white">{{ u.nombre }}</option>
                }
              </select>
            </div>

            <div>
              <label for="ing-minimo" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mínimo ({{ ingredientForm.unitOfMeasure }})
              </label>
              <input id="ing-minimo" type="number" min="0" step="any" placeholder="Opcional"
                [(ngModel)]="ingredientForm.minimo"
                class="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500" />
              <p class="text-[11px] text-slate-500 mt-1.5">Cuando quede menos, se marca "queda poco" y avisamos al gerente.</p>
            </div>
          </div>

          <div class="p-6 border-t border-slate-800/80 bg-slate-900/40 shrink-0 flex items-center justify-end gap-3">
            <button
              (click)="closeIngredientModal()"
              class="px-4 py-2 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="saveIngredient()"
              [disabled]="!ingredientForm.name.trim() || !ingredientForm.unitOfMeasure"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/25 cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Entrada, merma o conteo -->
    @if (movimientoDe(); as o) {
      <app-movimiento-inventario [branchId]="activeBranchId()!" [objetivo]="o"
        (cerrar)="movimientoDe.set(null)" (guardado)="alRegistrarMovimiento($event)" />
    }

    <!-- Historial de un ingrediente -->
    @if (historialDe(); as o) {
      <app-historial-inventario [branchId]="activeBranchId()!" [objetivo]="o" (cerrar)="historialDe.set(null)" />
    }
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out forwards;
    }
    .animate-scaleIn {
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Active navigation tab
  readonly activeTab = signal<'products' | 'ingredients' | 'adicionales'>('products');

  // Writable Signals for state
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  /** productId -> URL de su miniatura. */
  readonly fotos = signal<Record<string, string>>({});
  readonly subiendoFoto = signal<string | null>(null);
  readonly ingredients = signal<Ingredient[]>([]);
  
  readonly selectedCategoryId = signal<string>('');
  readonly searchQuery = signal<string>('');
  /** Recorrer los platillos sin foto de todas las categorías, uno tras otro. */
  readonly soloSinFoto = signal(false);
  readonly sinFotoTotal = computed(() => {
    const fotos = this.fotos();
    return this.products().filter((p) => !fotos[p.id]).length;
  });
  readonly ingredientSearchQuery = signal<string>('');
  readonly filtroExistencias = signal<'todos' | 'bajo' | 'sin'>('todos');
  readonly verDesactivados = signal(false);
  /** El ingrediente o producto al que se le registra un movimiento, y el del historial. */
  readonly movimientoDe = signal<ObjetivoInventario | null>(null);
  readonly historialDe = signal<ObjetivoInventario | null>(null);
  readonly unidadesDeInventario = UNIDADES_DE_INVENTARIO;
  readonly cantidadLegible = cantidadLegible;
  readonly viewMode = signal<'grid' | 'list'>('grid');

  // Expanded recipe breakdown product IDs
  readonly expandedRecipeIds = signal<Set<string>>(new Set());
  
  // Loaders & sync status
  readonly isLoading = signal(false);
  readonly isSyncing = signal(false);

  // Forms / Modals opening flags
  readonly isCategoryFormOpen = signal(false);
  readonly isProductModalOpen = signal(false);
  readonly isIngredientModalOpen = signal(false);
  readonly isAdjustStockModalOpen = signal(false);

  // SUPER_ADMIN & SYSTEM_ADMIN dropdown bindings (El Refrigerador)
  readonly isSuperAdmin = computed(() => {
    const role = this.authService.userRole();
    return role === 'SUPER_ADMIN' || role === 'SYSTEM_ADMIN';
  });

  // Restaurante y sucursal: los mismos para todo el panel (se eligen en la barra superior).
  private readonly sucursalActiva = inject(SucursalActivaService);
  readonly restaurants = this.sucursalActiva.restaurantes;
  readonly selectedRestaurantId = this.sucursalActiva.restaurantId;
  readonly selectedBranchId = this.sucursalActiva.branchId;

  /** Al elegir otra sucursal en la barra superior se recarga esta pantalla. */
  private readonly recargarAlCambiarSucursal = effect(() => {
    const b = this.selectedBranchId();
    if (!this.isSuperAdmin()) return;
    untracked(() => b && this.reloadAll());
  });

  readonly availableBranches = computed(() => {
    const rId = this.selectedRestaurantId();
    if (!rId) return [];
    const matched = this.restaurants().find((r) => r.id === rId);
    return matched ? matched.branches : [];
  });

  // Active Branch ID resolved dynamically according to role
  readonly activeBranchId = computed<string | null>(() => {
    if (this.isSuperAdmin()) {
      return this.selectedBranchId() || null;
    }
    const token = this.authService.decodedToken() as any;
    const branchFromToken = token?.branchId || token?.branch_id || this.authService.userBranchId();
    return branchFromToken !== undefined && branchFromToken !== null ? String(branchFromToken) : null;
  });

  // Category local form binding
  categoryForm = {
    id: '',
    name: '',
    active: true
  };

  // Product local form binding
  productForm: {
    id: string;
    name: string;
    price: number;
    description: string;
    active: boolean;
    isRecipe: boolean;
    trackStock: boolean;
    stock: number;
    recipeItems: RecipeItem[];
    isCombo: boolean;
    comboItems: { productId: string; cantidad: number }[];
    promoDesde: string;
    promoHasta: string;
    promoDias: number[];
    categoryId: string;
  } = this.formularioVacio(false);

  readonly diasSemana = [
    { valor: 1, corto: 'L', nombre: 'lunes' },
    { valor: 2, corto: 'M', nombre: 'martes' },
    { valor: 3, corto: 'Mi', nombre: 'miércoles' },
    { valor: 4, corto: 'J', nombre: 'jueves' },
    { valor: 5, corto: 'V', nombre: 'viernes' },
    { valor: 6, corto: 'S', nombre: 'sábado' },
    { valor: 7, corto: 'D', nombre: 'domingo' },
  ];

  /**
   * Lo que puede ir dentro de un combo: platillos sueltos (no otros combos),
   * agrupados por categoría para encontrarlos rápido en la lista.
   */
  readonly platillosParaCombo = computed(() => {
    const grupos = new Map<string, Product[]>();
    for (const p of this.products()) {
      if (p.isCombo || p.id.startsWith('temp-')) continue;
      const categoria = p.categoryName || 'Sin categoría';
      grupos.set(categoria, [...(grupos.get(categoria) ?? []), p]);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoria, platillos]) => ({ categoria, platillos: platillos.sort((a, b) => a.name.localeCompare(b.name)) }));
  });

  // Ingredient local form binding
  ingredientForm: {
    id: string;
    name: string;
    unitOfMeasure: string;
    minimo: number | null;
    active: boolean;
  } = {
    id: '',
    name: '',
    unitOfMeasure: 'g',
    minimo: null,
    active: true,
  };

  // Stock Adjustment local state
  adjustStockItem = signal<{
    type: 'PRODUCT' | 'INGREDIENT';
    id: string;
    name: string;
    unitOfMeasure?: string;
    stock: number;
  } | null>(null);

  adjustStockValue = signal<number>(0);

  // Computed signals
  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    return this.categories().find(c => c.id === id) || null;
  });

  readonly filteredProducts = computed(() => {
    const catId = this.selectedCategoryId();
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.products();

    if (this.soloSinFoto()) {
      const fotos = this.fotos();
      list = list.filter(p => !fotos[p.id]);
    } else if (catId) {
      list = list.filter(p => p.categoryId === catId);
    }
    if (query) {
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.description && p.description.toLowerCase().includes(query))
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredIngredients = computed(() => {
    const query = this.ingredientSearchQuery().trim().toLowerCase();
    let list = this.ingredients();

    if (query) {
      list = list.filter(ing => ing.name.toLowerCase().includes(query));
    }
    if (!this.verDesactivados()) {
      list = list.filter(ing => ing.active !== false);
    }
    if (this.filtroExistencias() === 'sin') {
      list = list.filter(ing => (ing.stock ?? 0) <= 0);
    } else if (this.filtroExistencias() === 'bajo') {
      list = list.filter(ing => this.estaBajoMinimo(ing));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly bajoMinimo = computed(() => this.ingredients().filter(i => i.active !== false && this.estaBajoMinimo(i)).length);

  private estaBajoMinimo(i: Ingredient): boolean {
    return i.stock !== null && i.stock !== undefined && !!i.minimo && i.stock < i.minimo;
  }

  /** En el editor de recetas solo los activos, más el que ya tenga ese renglón. */
  ingredientesParaReceta(actual: string): Ingredient[] {
    return this.ingredients().filter(i => i.active !== false || i.id === actual);
  }

  readonly sinExistencias = computed(() => this.ingredients().filter(i => i.stock !== null && i.stock !== undefined && i.stock <= 0).length);

  ngOnInit(): void {
    if (!this.isSuperAdmin()) {
      this.reloadAll();
    }
  }

  loadRestaurants(): void {
    this.http.get<Restaurant[]>(`${environment.apiUrl}/admin/restaurants`).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        this.restaurants.set(sorted);
        this.preseleccionarPrimeraSucursal(sorted);
      },
      error: (err) => console.error('Error fetching restaurants selector', err)
    });
  }

  /**
   * Deja elegido el primer restaurante y su primera sucursal, para no abrir
   * el catálogo en blanco esperando una selección.
   */
  private preseleccionarPrimeraSucursal(lista: Restaurant[]): void {
    if (this.selectedRestaurantId() || lista.length === 0) return;
    const inicial = sucursalInicial(lista, this.authService.userBranchId());
    if (!inicial) return;
    this.selectedRestaurantId.set(inicial.restaurantId);
    this.selectedBranchId.set(inicial.branchId);
    this.reloadAll();
  }

  onRestaurantChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRestaurantId.set(select.value);
    this.selectedBranchId.set('');
    this.categories.set([]);
    this.products.set([]);
    this.ingredients.set([]);
  }

  onBranchChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedBranchId.set(select.value);
    this.reloadAll();
  }

  reloadAll(): void {
    this.loadCatalogData();
    this.loadIngredients();
  }

  // ------------------------------------------------------------------
  // Fotos de los platillos
  // ------------------------------------------------------------------

  fotoDe(productId: string): string | null {
    const ruta = this.fotos()[productId];
    return ruta ? `${environment.apiUrl}${ruta}` : null;
  }

  private cargarFotos(): void {
    this.http.get<Record<string, string>>(`${environment.apiUrl}/products/fotos`).subscribe({
      next: (f) => this.fotos.set(f),
      error: (err) => console.error('No se pudieron cargar las fotos', err),
    });
  }

  async alElegirFoto(productId: string, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // Para poder elegir la misma foto otra vez si falla.
    if (!archivo) return;

    this.subiendoFoto.set(productId);
    try {
      const comprimida = await comprimirImagen(archivo);
      const datos = new FormData();
      datos.append('foto', comprimida, 'foto.jpg');
      this.http.post<{ miniatura: string }>(`${environment.apiUrl}/products/${productId}/foto`, datos).subscribe({
        next: (r) => {
          this.fotos.update((f) => ({ ...f, [productId]: r.miniatura }));
          this.subiendoFoto.set(null);
        },
        error: (err) => {
          this.subiendoFoto.set(null);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo subir la foto.');
        },
      });
    } catch (e) {
      this.subiendoFoto.set(null);
      this.avisos.error((e as Error).message);
    }
  }

  async quitarFoto(productId: string): Promise<void> {
    if (!(await this.avisos.confirmar({ titulo: '¿Quitar la foto?', mensaje: 'Dejará de verse en el menú en línea.', confirmar: 'Quitar foto', peligro: true }))) return;
    this.http.delete(`${environment.apiUrl}/products/${productId}/foto`).subscribe({
      next: () =>
        this.fotos.update((f) => {
          const copia = { ...f };
          delete copia[productId];
          return copia;
        }),
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo quitar la foto.'),
    });
  }

  /**
   * Initializes catalog data (categories & products) from backend with ?branchId=
   */
  loadCatalogData(): void {
    this.isLoading.set(true);
    this.cargarFotos();
    const branchId = this.activeBranchId();
    const queryParam = branchId ? `?branchId=${branchId}` : '';

    this.http.get<Category[]>(`${environment.apiUrl}/categories${queryParam}`).subscribe({
      next: (cats) => {
        const sortedCats = cats.sort((a, b) => a.name.localeCompare(b.name));
        this.categories.set(sortedCats);
        
        if (sortedCats.length > 0 && !this.selectedCategoryId()) {
          this.selectedCategoryId.set(sortedCats[0].id);
        }

        // Fetch products with ?branchId=
        this.http.get<Product[]>(`${environment.apiUrl}/products${queryParam}`).subscribe({
          next: (prods) => {
            this.products.set(prods);
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('Error fetching products', err);
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error fetching categories', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Loads ingredients list from backend with ?branchId=
   */
  loadIngredients(): void {
    const branchId = this.activeBranchId();
    const queryParam = branchId ? `?branchId=${branchId}` : '';

    this.http.get<Ingredient[]>(`${environment.apiUrl}/ingredients${queryParam}`).subscribe({
      next: (ings) => {
        this.ingredients.set(ings);
      },
      error: (err) => {
        console.error('Error fetching ingredients', err);
      }
    });
  }

  // --- Search ---
  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // --- Category Actions ---
  selectCategory(id: string): void {
    this.selectedCategoryId.set(id);
    this.soloSinFoto.set(false);
    this.cancelCategoryForm();
  }

  showCreateCategoryForm(): void {
    this.categoryForm = { id: '', name: '', active: true };
    this.isCategoryFormOpen.set(true);
  }

  editCategory(cat: Category): void {
    this.categoryForm = { id: cat.id, name: cat.name, active: cat.active };
    this.isCategoryFormOpen.set(true);
  }

  cancelCategoryForm(): void {
    this.isCategoryFormOpen.set(false);
  }

  saveCategory(): void {
    const name = this.categoryForm.name.trim();
    if (!name) return;

    this.isSyncing.set(true);
    this.isCategoryFormOpen.set(false);

    if (this.categoryForm.id) {
      const catId = this.categoryForm.id;
      const previousCats = [...this.categories()];
      
      this.categories.update(list => 
        list.map(c => c.id === catId ? { ...c, name } : c)
      );

      this.http.put<Category>(`${environment.apiUrl}/categories/${catId}`, { name, active: true }).subscribe({
        next: (updated) => {
          this.categories.update(list => list.map(c => c.id === catId ? updated : c));
          this.isSyncing.set(false);
        },
        error: (err) => {
          console.error('Error updating category', err);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo guardar la categoría.');
          this.categories.set(previousCats);
          this.isSyncing.set(false);
        }
      });
    } else {
      const tempId = 'temp-' + Math.random();
      const tempCategory: Category = {
        id: tempId,
        restaurantId: '',
        name,
        active: true
      };
      
      this.categories.update(list => [...list, tempCategory]);
      if (!this.selectedCategoryId()) {
        this.selectedCategoryId.set(tempId);
      }

      this.http.post<Category>(`${environment.apiUrl}/categories`, { name, active: true }).subscribe({
        next: (created) => {
          this.categories.update(list => list.map(c => c.id === tempId ? created : c));
          if (this.selectedCategoryId() === tempId) {
            this.selectedCategoryId.set(created.id);
          }
          this.isSyncing.set(false);
        },
        error: (err) => {
          console.error('Error creating category', err);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo crear la categoría.');
          this.categories.update(list => list.filter(c => c.id !== tempId));
          if (this.selectedCategoryId() === tempId) {
            const first = this.categories()[0];
            this.selectedCategoryId.set(first ? first.id : '');
          }
          this.isSyncing.set(false);
        }
      });
    }
  }

  async deleteCategoryPrompt(id: string): Promise<void> {
    if (!(await this.avisos.confirmar({ titulo: '¿Eliminar la categoría?', mensaje: 'También se eliminan todos sus productos.', confirmar: 'Eliminar categoría', peligro: true }))) return;

    this.isSyncing.set(true);
    const previousCats = [...this.categories()];
    const previousProds = [...this.products()];

    this.categories.update(list => list.filter(c => c.id !== id));
    this.products.update(list => list.filter(p => p.categoryId !== id));

    if (this.selectedCategoryId() === id) {
      const first = this.categories()[0];
      this.selectedCategoryId.set(first ? first.id : '');
    }

    this.http.delete(`${environment.apiUrl}/categories/${id}`).subscribe({
      next: () => {
        this.isSyncing.set(false);
      },
      error: (err) => {
        console.error('Error deleting category', err);
        this.categories.set(previousCats);
        this.products.set(previousProds);
        this.selectedCategoryId.set(id);
        this.isSyncing.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'Ocurrió un error al eliminar la categoría.');
      }
    });
  }

  // --- Product Actions ---
  private formularioVacio(combo: boolean) {
    return {
      id: '',
      name: '',
      price: 0,
      description: '',
      active: true,
      isRecipe: false,
      trackStock: false,
      stock: 0,
      recipeItems: [] as RecipeItem[],
      isCombo: combo,
      comboItems: [] as { productId: string; cantidad: number }[],
      promoDesde: '',
      promoHasta: '',
      promoDias: [] as number[],
      categoryId: '',
    };
  }

  showCreateProductModal(combo = false): void {
    this.productForm = this.formularioVacio(combo);
    // Un combo nuevo va de entrada a la categoría de combos, si existe.
    this.productForm.categoryId = (combo ? this.categoriaDeCombos()?.id : null) ?? this.selectedCategoryId();
    if (combo) this.agregarAlCombo();
    this.isProductModalOpen.set(true);
  }

  // --- Combos ---

  /** La categoría "Combos", "Paquetes" o "Promociones", si el restaurante tiene una. */
  categoriaDeCombos(): Category | undefined {
    return this.categories().find((c) => /combo|paquete|promo/i.test(c.name));
  }

  hayCategoriaDeCombos(): boolean {
    return !!this.categoriaDeCombos();
  }

  volverCombo(): void {
    this.productForm.isCombo = true;
    if (this.productForm.comboItems.length === 0) this.agregarAlCombo();
  }

  agregarAlCombo(): void {
    this.productForm.comboItems.push({ productId: '', cantidad: 1 });
  }

  alternarDia(dia: number): void {
    const dias = this.productForm.promoDias;
    this.productForm.promoDias = dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort();
  }

  diasElegidosTexto(): string {
    const nombres = this.productForm.promoDias.map((d) => this.diasSemana[d - 1].nombre);
    return nombres.length === 1 ? nombres[0] : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
  }

  precioNormalForm(): number {
    return this.productForm.comboItems.reduce((suma, parte) => {
      const p = this.products().find((x) => x.id === parte.productId);
      return suma + (p ? p.price * (Number(parte.cantidad) || 0) : 0);
    }, 0);
  }

  ahorroForm(): number {
    return Math.round((this.precioNormalForm() - (Number(this.productForm.price) || 0)) * 100) / 100;
  }

  porcentajeAhorroForm(): number {
    const normal = this.precioNormalForm();
    return normal > 0 ? Math.round((this.ahorroForm() / normal) * 100) : 0;
  }

  /** Lo que falta para poder guardar, dicho en palabras; null si ya se puede. */
  faltaParaGuardar(): string | null {
    const f = this.productForm;
    if (!f.name.trim()) return 'Escribe el nombre.';
    if (!f.categoryId) return 'Elige la categoría.';
    if (!(Number(f.price) > 0)) return f.isCombo ? 'Escribe el precio del combo.' : 'Escribe el precio.';
    if (!f.isCombo) return null;
    if (f.comboItems.length === 0) return 'Agrega los platillos que incluye.';
    if (f.comboItems.some((p) => !p.productId)) return 'Elige el platillo de cada renglón.';
    if (f.comboItems.some((p) => !Number.isInteger(Number(p.cantidad)) || p.cantidad < 1 || p.cantidad > 50)) {
      return 'Cada cantidad va de 1 a 50.';
    }
    if (f.comboItems.reduce((s, p) => s + (Number(p.cantidad) || 0), 0) < 2) {
      return 'Un combo lleva al menos 2 platillos: sube la cantidad o agrega otro.';
    }
    if (f.promoDesde && f.promoHasta && f.promoDesde > f.promoHasta) return 'La fecha "Hasta" va después de "Desde".';
    return null;
  }

  /** Cada renglón con platillo y cantidad válida, y al menos 2 platillos en total. */
  comboCompleto(): boolean {
    const partes = this.productForm.comboItems;
    const validas = partes.every((p) => p.productId && Number.isInteger(Number(p.cantidad)) && p.cantidad >= 1 && p.cantidad <= 50);
    const total = partes.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    return partes.length > 0 && validas && total >= 2;
  }

  textoIncluye(prod: Product): string {
    return (prod.comboItems ?? []).map((c) => `${c.cantidad} × ${c.nombre}`).join(', ');
  }

  ahorroDe(prod: Product): number | null {
    if (!prod.isCombo || prod.precioNormal == null) return null;
    const ahorro = Math.round((prod.precioNormal - prod.price) * 100) / 100;
    return ahorro > 0 ? ahorro : null;
  }

  editProduct(prod: Product): void {
    this.productForm = {
      id: prod.id,
      name: prod.name,
      price: prod.price,
      description: prod.description || '',
      active: prod.active,
      isRecipe: prod.isRecipe ?? false,
      trackStock: prod.trackStock ?? false,
      stock: prod.stock ?? 0,
      recipeItems: prod.recipeItems ? prod.recipeItems.map(item => {
        const matchedIng = this.ingredients().find(i => i.id === item.ingredientId);
        return {
          ...item,
          recipeUnit: item.recipeUnit || matchedIng?.unitOfMeasure || ''
        };
      }) : [],
      isCombo: prod.isCombo ?? false,
      comboItems: (prod.comboItems ?? []).map((c) => ({ productId: c.productId, cantidad: c.cantidad })),
      promoDesde: prod.promoDesde ?? '',
      promoHasta: prod.promoHasta ?? '',
      promoDias: [...(prod.promoDias ?? [])],
      categoryId: prod.categoryId,
    };
    this.isProductModalOpen.set(true);
  }

  closeProductModal(): void {
    this.isProductModalOpen.set(false);
  }

  addRecipeItem(): void {
    const available = this.ingredients();
    const defaultIng = available.length > 0 ? available[0] : null;
    this.productForm.recipeItems.push({
      ingredientId: defaultIng ? defaultIng.id : '',
      ingredientName: defaultIng ? defaultIng.name : '',
      quantity: 1,
      recipeUnit: defaultIng ? defaultIng.unitOfMeasure : ''
    });
  }

  onRecipeIngredientChange(item: RecipeItem): void {
    const ing = this.ingredients().find(i => i.id === item.ingredientId);
    if (ing) {
      item.ingredientName = ing.name;
      item.recipeUnit = ing.unitOfMeasure;
    }
  }

  removeRecipeItem(index: number): void {
    this.productForm.recipeItems.splice(index, 1);
  }

  saveProduct(): void {
    const name = this.productForm.name.trim();
    const price = this.productForm.price;
    const description = this.productForm.description.trim();
    const active = this.productForm.active;
    const categoryId = this.productForm.categoryId;
    const categoryName = this.categories().find((c) => c.id === categoryId)?.name || '';
    const branchId = this.activeBranchId();

    if (!name || price <= 0 || !categoryId || this.faltaParaGuardar()) return;

    this.isSyncing.set(true);
    this.isProductModalOpen.set(false);

    const isCombo = this.productForm.isCombo;
    if (isCombo && !this.comboCompleto()) return;
    const isRecipe = !isCombo && this.productForm.isRecipe;
    const trackStock = !isRecipe && !isCombo ? this.productForm.trackStock : false;
    const stock = (!isRecipe && trackStock) ? this.productForm.stock : 0;
    const recipeItems = isRecipe ? this.productForm.recipeItems : [];
    const comboItems = isCombo
      ? this.productForm.comboItems.map((c) => ({ productId: c.productId, cantidad: Number(c.cantidad) }))
      : [];
    const promoDesde = isCombo && this.productForm.promoDesde ? this.productForm.promoDesde : null;
    const promoHasta = isCombo && this.productForm.promoHasta ? this.productForm.promoHasta : null;
    const promoDias = isCombo ? this.productForm.promoDias : [];

    const requestPayload = {
      categoryId,
      name,
      price,
      description,
      active,
      isRecipe,
      trackStock,
      stock,
      recipeItems,
      isCombo,
      comboItems,
      promoDesde,
      promoHasta,
      promoDias,
      branchId
    };

    if (this.productForm.id) {
      const prodId = this.productForm.id;
      const previousProds = [...this.products()];

      this.products.update(list => 
        list.map(p => p.id === prodId ? { 
          ...p, 
          categoryId,
          categoryName,
          name, 
          price, 
          description, 
          active,
          isRecipe,
          trackStock,
          stock,
          recipeItems
        } : p)
      );

      this.http.put<Product>(`${environment.apiUrl}/products/${prodId}`, requestPayload).subscribe({
        next: (updated) => {
          this.products.update(list => list.map(p => p.id === prodId ? updated : p));
          this.isSyncing.set(false);
          this.reloadAll();
        },
        error: (err) => {
          console.error('Error updating product', err);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo guardar el producto.');
          this.products.set(previousProds);
          this.isSyncing.set(false);
          this.isProductModalOpen.set(true); // Lo escrito sigue ahí: se corrige y se vuelve a guardar.
        }
      });
    } else {
      const tempId = 'temp-prod-' + Math.random();
      const tempProduct: Product = {
        id: tempId,
        categoryId,
        categoryName,
        name,
        price,
        description,
        active,
        isRecipe,
        trackStock,
        stock,
        recipeItems
      };

      this.products.update(list => [...list, tempProduct]);

      this.http.post<Product>(`${environment.apiUrl}/products`, requestPayload).subscribe({
        next: (created) => {
          this.products.update(list => list.map(p => p.id === tempId ? created : p));
          this.isSyncing.set(false);
          this.reloadAll();
        },
        error: (err) => {
          console.error('Error creating product', err);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo crear el producto.');
          this.products.update(list => list.filter(p => p.id !== tempId));
          this.isSyncing.set(false);
          this.isProductModalOpen.set(true); // Lo escrito sigue ahí: se corrige y se vuelve a guardar.
        }
      });
    }
  }

  async deleteProductPrompt(id: string): Promise<void> {
    if (!(await this.avisos.confirmar({ titulo: '¿Eliminar el producto?', mensaje: 'Deja de aparecer en el menú y en el panel de meseros.', confirmar: 'Eliminar producto', peligro: true }))) return;

    this.isSyncing.set(true);
    const previousProds = [...this.products()];

    this.products.update(list => list.filter(p => p.id !== id));

    this.http.delete(`${environment.apiUrl}/products/${id}`).subscribe({
      next: () => {
        this.isSyncing.set(false);
      },
      error: (err) => {
        console.error('Error deleting product', err);
        this.products.set(previousProds);
        this.isSyncing.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'Ocurrió un error al eliminar el producto.');
      }
    });
  }

  // --- Ingredient Actions ---
  showCreateIngredientModal(): void {
    this.ingredientForm = {
      id: '',
      name: '',
      unitOfMeasure: 'g',
      minimo: null,
      active: true,
    };
    this.isIngredientModalOpen.set(true);
  }

  editIngredient(ing: Ingredient): void {
    this.ingredientForm = {
      id: ing.id,
      name: ing.name,
      unitOfMeasure: ing.unitOfMeasure,
      minimo: ing.minimo ?? null,
      active: ing.active !== false,
    };
    this.isIngredientModalOpen.set(true);
  }

  closeIngredientModal(): void {
    this.isIngredientModalOpen.set(false);
  }

  saveIngredient(): void {
    const name = this.ingredientForm.name.trim();
    const unitOfMeasure = this.ingredientForm.unitOfMeasure;
    const branchId = this.activeBranchId();

    if (!name || !unitOfMeasure) return;

    this.isSyncing.set(true);
    this.isIngredientModalOpen.set(false);

    const minimo = this.ingredientForm.minimo !== null && `${this.ingredientForm.minimo}` !== '' ? Number(this.ingredientForm.minimo) : null;
    const payload = { name, unitOfMeasure, branchId, minimo, active: this.ingredientForm.active };

    if (this.ingredientForm.id) {
      const ingId = this.ingredientForm.id;
      const previousIngs = [...this.ingredients()];

      this.ingredients.update(list =>
        list.map(i => i.id === ingId ? { ...i, name, unitOfMeasure, minimo } : i)
      );

      this.http.put<Ingredient>(`${environment.apiUrl}/ingredients/${ingId}`, payload).subscribe({
        next: (updated) => {
          this.ingredients.update(list => list.map(i => i.id === ingId ? updated : i));
          this.isSyncing.set(false);
          this.loadIngredients();
        },
        error: (err) => {
          console.error('Error updating ingredient', err);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo guardar el ingrediente.');
          this.ingredients.set(previousIngs);
          this.isSyncing.set(false);
        }
      });
    } else {
      const tempId = 'temp-ing-' + Math.random();
      const tempIng: Ingredient = {
        id: tempId,
        name,
        unitOfMeasure,
        stock: 0
      };

      this.ingredients.update(list => [...list, tempIng]);

      this.http.post<Ingredient>(`${environment.apiUrl}/ingredients`, payload).subscribe({
        next: (created) => {
          this.ingredients.update(list => list.map(i => i.id === tempId ? created : i));
          this.isSyncing.set(false);
          this.loadIngredients();
        },
        error: (err) => {
          console.error('Error creating ingredient', err);
          this.avisos.error(err.error?.error || err.error?.message || 'No se pudo crear el ingrediente.');
          this.ingredients.update(list => list.filter(i => i.id !== tempId));
          this.isSyncing.set(false);
        }
      });
    }
  }

  async deleteIngredientPrompt(id: string): Promise<void> {
    const ing = this.ingredients().find(i => i.id === id);
    if (ing?.usos) {
      // Borrarlo rompería sus recetas: se ofrece desactivarlo.
      if (await this.avisos.confirmar({
        titulo: `${ing.name} se usa en ${ing.usos} ${ing.usos === 1 ? 'platillo' : 'platillos'}`,
        mensaje: 'No se puede borrar sin romper esas recetas. ¿Lo desactivas? Deja de ofrecerse en el editor de recetas y conserva su historial.',
        confirmar: 'Desactivar',
      })) {
        this.alternarActivo(ing);
      }
      return;
    }
    if (!(await this.avisos.confirmar({ titulo: '¿Eliminar el ingrediente?', mensaje: 'No se usa en ninguna receta. Si ya tiene existencias o historial, te propondremos desactivarlo.', confirmar: 'Eliminar ingrediente', peligro: true }))) return;

    this.isSyncing.set(true);
    const previousIngs = [...this.ingredients()];

    this.ingredients.update(list => list.filter(i => i.id !== id));

    this.http.delete(`${environment.apiUrl}/ingredients/${id}`).subscribe({
      next: () => {
        this.isSyncing.set(false);
      },
      error: (err) => {
        console.error('Error deleting ingredient', err);
        this.ingredients.set(previousIngs);
        this.isSyncing.set(false);
        this.avisos.error(err.error?.error || err.error?.message || 'Ocurrió un error al eliminar el ingrediente.');
      }
    });
  }

  // --- Adjust Stock Modal Actions (Requirement 4) ---
  openAdjustStockModal(type: 'PRODUCT' | 'INGREDIENT', item: { id: string; name: string; unitOfMeasure?: string; stock?: number | null }): void {
    const branchId = this.activeBranchId();
    if (!branchId) {
      this.avisos.error('Por favor selecciona una sucursal para ajustar el inventario.');
      return;
    }

    this.movimientoDe.set({
      tipo: type === 'PRODUCT' ? 'PRODUCTO' : 'INGREDIENTE',
      id: item.id,
      nombre: item.name,
      unidad: type === 'PRODUCT' ? 'pieza' : (item.unitOfMeasure ?? ''),
      stock: Number(item.stock ?? 0),
    });
  }

  /** "Se acabó" por hoy en la sucursal elegida, o "ya hay" para volver a ofrecerlo. */
  alternarAgotado(prod: Product): void {
    const branchId = this.activeBranchId();
    if (!branchId) return;
    const url = `${environment.apiUrl}/branches/${branchId}/products/${prod.id}/agotado`;
    const peticion = prod.agotadoHoy ? this.http.delete(url) : this.http.post(url, {});
    peticion.subscribe({
      next: () => {
        this.avisos.exito(prod.agotadoHoy ? `${prod.name} vuelve a ofrecerse.` : `${prod.name} ya no se ofrece por hoy.`);
        this.reloadAll();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar.'),
    });
  }

  alRegistrarMovimiento(mensaje: string): void {
    this.movimientoDe.set(null);
    this.avisos.exito(mensaje);
    this.reloadAll();
  }

  verHistorial(ing: Ingredient): void {
    if (!this.activeBranchId()) return;
    this.historialDe.set({ tipo: 'INGREDIENTE', id: ing.id, nombre: ing.name, unidad: ing.unitOfMeasure, stock: Number(ing.stock ?? 0) });
  }

  /** Desactivar en vez de borrar: deja de ofrecerse en recetas y conserva su historial. */
  alternarActivo(ing: Ingredient): void {
    const active = ing.active === false;
    this.http.put<Ingredient>(`${environment.apiUrl}/ingredients/${ing.id}`, {
      name: ing.name, unitOfMeasure: ing.unitOfMeasure, minimo: ing.minimo ?? null, active,
    }).subscribe({
      next: () => {
        this.avisos.exito(active ? `${ing.name} vuelve a ofrecerse en las recetas.` : `${ing.name} quedó desactivado.`);
        this.loadIngredients();
      },
      error: (err) => this.avisos.error(err.error?.error || 'No se pudo cambiar.'),
    });
  }

  closeAdjustStockModal(): void {
    this.isAdjustStockModalOpen.set(false);
    this.adjustStockItem.set(null);
  }

  saveStockAdjustment(): void {
    const item = this.adjustStockItem();
    const branchId = this.activeBranchId();

    if (!item || !branchId) return;

    const newStock = Number(this.adjustStockValue());
    if (!Number.isFinite(newStock) || newStock < 0) {
      this.avisos.error('Escribe una cantidad de cero o más.');
      return;
    }
    this.isSyncing.set(true);

    const endpoint = item.type === 'PRODUCT'
      ? `${environment.apiUrl}/products/${item.id}/stock?branchId=${branchId}`
      : `${environment.apiUrl}/ingredients/${item.id}/stock?branchId=${branchId}`;

    const payload = { stock: newStock };

    this.http.patch(endpoint, payload).subscribe({
      next: () => {
        this.isAdjustStockModalOpen.set(false);
        this.adjustStockItem.set(null);
        this.isSyncing.set(false);
        this.reloadAll();
      },
      error: (err) => {
        console.error('Error adjusting stock via PATCH endpoint:', err);
        this.avisos.error(err.error?.error || err.error?.message || 'No se pudieron guardar las existencias.');
        this.isSyncing.set(false);
      }
    });
  }

  // --- Recipe Raw Material Breakdown Helpers ---
  toggleRecipeBreakdown(productId: string): void {
    this.expandedRecipeIds.update(set => {
      const next = new Set(set);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  isRecipeBreakdownExpanded(productId: string): boolean {
    return this.expandedRecipeIds().has(productId);
  }

  formatQuantity(val: number): string {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val.toFixed(2)).toLocaleString('es-MX');
  }

  // --- Dynamic Recipe Unit Helpers ---
  getAvailableUnitsForItem(item: RecipeItem): string[] {
    const ing = item.ingredientId ? this.ingredients().find(i => i.id === item.ingredientId) : undefined;
    const unidades = unidadesCompatibles(ing?.unitOfMeasure);
    // Una receta vieja puede traer otra unidad: se muestra para no perderla.
    const actual = unidadCanonica(item.recipeUnit);
    if (actual && !unidades.includes(actual)) unidades.push(actual);
    return unidades.length ? unidades : ['-'];
  }

  getRecipeBreakdown(prod: Product) {
    if (!prod.recipeItems || prod.recipeItems.length === 0) return [];
    const currentStock = prod.stock ?? 0;
    const ingredientsMap = new Map(this.ingredients().map(i => [i.id, i]));

    const items = prod.recipeItems.map(item => {
      const ing = ingredientsMap.get(item.ingredientId);
      const ingStock = ing?.stock ?? 0;
      const baseUnit = ing?.unitOfMeasure || 'unidades';
      const name = item.ingredientName || ing?.name || 'Ingrediente';
      const recipeUnit = item.recipeUnit || baseUnit;

      // Existencias del ingrediente expresadas en la unidad de la receta (kg → g).
      const availableStockInRecipeUnit = convertirUnidad(ingStock, baseUnit, recipeUnit);

      const requiredTotal = item.quantity * currentStock;
      const potentialPortions = item.quantity > 0 ? Math.floor(availableStockInRecipeUnit / item.quantity) : Infinity;

      return {
        ingredientId: item.ingredientId,
        name,
        unitOfMeasure: recipeUnit,
        quantityPerUnit: item.quantity,
        requiredTotal,
        availableStock: availableStockInRecipeUnit,
        potentialPortions
      };
    });

    const validPotentials = items.map(i => i.potentialPortions).filter(p => Number.isFinite(p));
    const minPotential = validPotentials.length > 0 ? Math.min(...validPotentials) : Infinity;

    return items.map(item => ({
      ...item,
      isBottleneck: item.potentialPortions === minPotential && minPotential !== Infinity
    }));
  }
}
