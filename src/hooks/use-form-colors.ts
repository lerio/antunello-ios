import { FormColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The transaction form's web-matched palette for the current colour scheme. */
export function useFormColors() {
  const scheme = useColorScheme();
  return FormColors[scheme === 'dark' ? 'dark' : 'light'];
}
