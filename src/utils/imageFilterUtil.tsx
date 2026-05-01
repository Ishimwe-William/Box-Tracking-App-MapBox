// src/utils/imageFilterUtil.ts

export type CloudinaryResource = {
    public_id: string;
    version: number;
    format: string;
    created_at?: string; // Cloudinary includes this in the JSON list
};

export const filterImages = (
    images: CloudinaryResource[],
    searchQuery: string,
    startDate: Date | null,
    endDate: Date | null
): CloudinaryResource[] => {
    return images.filter(img => {
        // 1. Text Search (matches filename)
        const filename = img.public_id.split('/').pop()?.toLowerCase() || '';
        const matchesSearch = filename.includes(searchQuery.toLowerCase());

        // 2. Date Range Filter
        let matchesDate = true;
        if (img.created_at) {
            const imgDate = new Date(img.created_at);

            // Check if it's after the start date
            if (startDate && imgDate < startDate) {
                matchesDate = false;
            }

            // Check if it's before the end date (adjusting to the end of the day)
            if (endDate) {
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                if (imgDate > endOfDay) {
                    matchesDate = false;
                }
            }
        }

        return matchesSearch && matchesDate;
    }).sort((a, b) => {
        // Optional: Sort newest first
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
    });
};