export interface Ingredient {
  id: string;
  name: string;
  unitOfMeasure: string;
  stock?: number | null;
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
}
