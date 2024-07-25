'use server';

import { revalidatePath } from 'next/cache';

export async function revalidateFavorites(type?: string) {
    revalidatePath('/favourites');

    if (type) {
        switch (type) {
            case 'note':
                revalidatePath('/notes');
                break;
            case 'pastPaper':
                revalidatePath('/past_papers');
                break;
            case 'forum':
                revalidatePath('/forum');
                break;
            case 'subject':
                revalidatePath('/resources');
                break;
        }
    }
}
