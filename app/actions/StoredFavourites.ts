import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { updateBookmark } from '../actions/handleFavs';
import { revalidateFavorites } from '../actions/revalidateFavourites';

type FavoriteItem = {
    id: string;
    type: 'note' | 'pastpaper' | 'forumpost' | 'subject';
    title: string;
};

type FavoritesStore = {
    favorites: FavoriteItem[];
    toggleFavorite: (item: FavoriteItem) => Promise<void>;
    isFavorite: (id: string, type: FavoriteItem['type']) => boolean;
    setInitialFavorites: (favorites: FavoriteItem[]) => void;
};

export const useFavoritesStore = create<FavoritesStore>()(
    persist(
        (set, get) => ({
            favorites: [],
            toggleFavorite: async (item) => {
                const { favorites } = get();
                const isFav = favorites.some(fav => fav.id === item.id && fav.type === item.type);
                const newFavState = !isFav;

                try {
                    const result = await updateBookmark(item.type, item.id, newFavState);
                    if (result.success) {
                        set(state => ({
                            favorites: newFavState
                                ? [...state.favorites, item]
                                : state.favorites.filter(fav => !(fav.id === item.id && fav.type === item.type))
                        }));
                        await revalidateFavorites(item.type);
                    } else {
                        console.error('Failed to update bookmarked item:', result.error);
                    }
                } catch (error) {
                    console.error('Error updating bookmarked item:', error);
                }
            },
            isFavorite: (id, type) => {
                return get().favorites.some(fav => fav.id === id && fav.type === type);
            },
            setInitialFavorites: (favorites) => {
                set({ favorites });
            },
        }),
        {
            name: 'favorites-storage',
        }
    )
);
