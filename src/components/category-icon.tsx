import {
  Apple,
  ArrowRightLeft,
  BriefcaseBusiness,
  BriefcaseMedical,
  CarFront,
  CreditCard,
  Flower,
  Fuel,
  Gift,
  GraduationCap,
  House,
  Landmark,
  Plane,
  Popcorn,
  Receipt,
  Shield,
  ShoppingBag,
  SquareParking,
  Star,
  TrainFront,
  Utensils,
  Volleyball,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import { customIconName } from '@/features/categories/registry';
import { useCustomCategories } from '@/features/categories/use-categories';

/**
 * The same Lucide icons the web app uses, rather than SF Symbol lookalikes.
 *
 * The two sets were visibly different — Lucide's apple for groceries versus
 * SF Symbols' cart, for instance. Rendering Lucide through react-native-svg
 * keeps the category and transaction icons identical across clients.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Money Transfer': ArrowRightLeft,
  'Bank Movements': CreditCard,
  Dining: Utensils,
  Education: GraduationCap,
  Entertainment: Popcorn,
  Fitness: Volleyball,
  'Gifts and Donations': Gift,
  'Government Benefits': Landmark,
  Groceries: Apple,
  Health: BriefcaseMedical,
  Housing: House,
  Insurance: Shield,
  'Other Income': Star,
  'Personal Care': Flower,
  'Primary Income': BriefcaseBusiness,
  Services: Wrench,
  Shopping: ShoppingBag,
  'Taxes and Fines': Receipt,
  Transportation: TrainFront,
  Travel: Plane,
};

/** The subcategory wins where it says something more specific. */
const SUBCATEGORY_ICONS: Record<string, LucideIcon> = {
  Fuel,
  'Parking and Tolls': SquareParking,
  'Public Transportation': TrainFront,
  'Taxi and Car Sharing': CarFront,
  'Vehicles and Maintenance': Wrench,
};

/** A Lucide icon by component name, e.g. "Utensils"; undefined if this version has no such icon. */
export function lucideIconByName(name: string): LucideIcon | undefined {
  return (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name];
}

/** The Lucide component name of a category's icon — custom or built-in — for showing it in a form. */
export function categoryIconName(category: string): string | undefined {
  return customIconName(category) ?? CATEGORY_ICONS[category]?.displayName;
}

function iconFor(category: string, subCategory?: string | null): LucideIcon {
  const customName = customIconName(category);
  const custom = customName ? lucideIconByName(customName) : undefined;

  return (
    (subCategory ? SUBCATEGORY_ICONS[subCategory] : undefined) ??
    CATEGORY_ICONS[category] ??
    custom ??
    CATEGORY_ICONS.Services
  );
}

type CategoryGlyphProps = {
  category: string;
  subCategory?: string | null;
  size?: number;
  color: string;
};

/** The Lucide icon for a category or transaction, at the size the row needs. */
export function CategoryGlyph({
  category,
  subCategory,
  size = 19,
  color,
}: CategoryGlyphProps) {
  // Re-renders this glyph when the user's custom category icons load.
  useCustomCategories();
  const Icon = iconFor(category, subCategory);
  // The lookup returns one of the module-level Lucide components, not a
  // component created here; the compiler rule cannot see through the map.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon size={size} color={color} strokeWidth={2} />;
}
