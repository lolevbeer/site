#!/bin/bash

# Clear all generated image sizes (keep original PNGs)
# This will force Payload to regenerate them with new size configuration

cd public/uploads

echo "🗑️  Removing old image sizes..."

# Remove all -250x250.webp files (old card size)
rm -f *-250x250.webp

# Remove all -1-* files (duplicates)
rm -f *-1-*.webp

# Keep only .png and main .webp files
# The main .webp files will be regenerated with new sizes on next upload

echo "✅ Cleared old image sizes"
echo "📝 Next steps:"
echo "   1. Restart your dev server"
echo "   2. Go to /admin/collections/media"
echo "   3. Re-upload each beer image (or use bulk re-upload)"
echo "   4. Payload will generate new sizes: 150px thumbnail, 500px card, 1200px detail"
