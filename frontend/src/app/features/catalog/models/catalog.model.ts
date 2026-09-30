export interface Ingredient {
  id: string;
  name: string;
  unitOfMeasure: string;
  stock?: number | null;
  active?: boolean;
  /** Por debajo de esto, "queda poco". */
  minimo?: number | null;
  /** En cuántos platillos se usa. */
  usos?: number;
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  recipeUnit?: string;
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  active: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  price: number;
  description: string;
  active: boolean;
  isRecipe?: boolean;
  trackStock?: boolean;
  stock?: number | null;
  recipeItems?: RecipeItem[];
  /** Combo o paquete: lleva platillos del menú en vez de receta. */
  isCombo?: boolean;
  comboItems?: ComboItem[] | null;
  /** Lo que costarían sus platillos por separado. */
  precioNormal?: number | null;
  /** Vigencia de la promoción (fechas yyyy-mm-dd; días 1 = lunes … 7 = domingo). */
  promoDesde?: string | null;
  promoHasta?: string | null;
  promoDias?: number[];
  /** "martes y jueves, del 1 oct al 31 oct"; null si se vende siempre. */
  vigencia?: string | null;
  vigenteHoy?: boolean;
  /** No se puede pedir hoy en la sucursal elegida. */
  agotado?: boolean;
  /** Se marcó "se acabó" a mano hoy. */
  agotadoHoy?: boolean;
}

export interface ComboItem {
  productId: string;
  cantidad: number;
  nombre?: string;
  precio?: number;
  activo?: boolean;
}
