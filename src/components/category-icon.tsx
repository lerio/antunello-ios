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

function iconFor(category: string, subCategory?: string | null): LucideIcon {
  return (
    (subCategory ? SUBCATEGORY_ICONS[subCategory] : undefined) ??
    CATEGORY_ICONS[category] ??
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
  const Icon = iconFor(category, subCategory);
  // The lookup returns one of the module-level Lucide components, not a
  // component created here; the compiler rule cannot see through the map.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon size={size} color={color} strokeWidth={2} />;
}
