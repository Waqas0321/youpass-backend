import { IconLayoutGrid } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { EventDrinkCategory } from '../../api/client';

type Props = {
  categories: EventDrinkCategory[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
};

export function EventDrinkCategoryBar({ categories, selectedCategory, onSelectCategory }: Props) {
  const { t } = useI18n();

  return (
    <div className="drink-category-bar">
      <button
        type="button"
        className={
          selectedCategory === 'all'
            ? 'drink-category-chip drink-category-chip--active'
            : 'drink-category-chip'
        }
        onClick={() => onSelectCategory('all')}
      >
        <span className="drink-category-chip__icon drink-category-chip__icon--grid">
          <IconLayoutGrid />
        </span>
        {t('drinkMenu.allCategories')}
      </button>

      {categories.map((category) => (
        <button
          key={category.slug}
          type="button"
          className={
            selectedCategory === category.slug
              ? 'drink-category-chip drink-category-chip--active'
              : 'drink-category-chip'
          }
          onClick={() => onSelectCategory(category.slug)}
        >
          {category.icon ? (
            <span className="drink-category-chip__icon" aria-hidden>
              {category.icon}
            </span>
          ) : null}
          {category.name}
        </button>
      ))}
    </div>
  );
}
