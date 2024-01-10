#!/bin/bash

# This script resizes and converts PNG images to WebP format.
# It skips processing if the file name matches *-white.png.
# The script uses the cwebp tool to convert images to WebP format and the convert tool to add a white background to images.
# The resized images are saved with the same name as the original file, but with the .webp or -small.webp suffix.
# The images are resized to specific dimensions and cropped to specific coordinates before conversion.

shopt -s nullglob

for file in *-*\.png *.png; do
  if [[ "$file" == *"-white.png" ]]; then
    continue
  fi

  if [[ ! -f "$(basename "$file" .png).webp" ]]; then
    cwebp -q 100 -resize 386 405  -crop 330 300 1930 2025 "$file" -o "$(basename "$file" .png).webp"
  fi

  if [[ ! -f "$(basename "$file" .png)-small.webp" ]]; then
    cwebp -q 100 -resize 38 40  -crop 330 300 1930 2025 "$file" -o "$(basename "$file" .png)-small.webp"
  fi

  if [[ ! -f "$(basename "$file" .png)-white.png" ]]; then
    convert "$file" -background white -alpha remove -alpha off "$(basename "$file" .png)-white.png"
  fi
done
