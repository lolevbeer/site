#!/bin/bash

for file in *.png; do
  cwebp -q 100 -resize 386 405  -crop 330 300 1930 2025 "$file" -o "$(basename "$file" .png).webp"
  cwebp -q 100 -resize 38 40  -crop 330 300 1930 2025 "$file" -o "$(basename "$file" .png)-small.webp"
  convert "$file" -background white -alpha remove -alpha off "$(basename "$file" .png)-white.png"
done
