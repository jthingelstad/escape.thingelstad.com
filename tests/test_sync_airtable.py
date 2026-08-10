import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from scripts.sync_airtable import photo_aspect_ratio_matches, resize_photo


class ResizePhotoTests(unittest.TestCase):
    def test_applies_exif_orientation_even_without_resizing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oriented.jpeg"
            image = Image.new("RGB", (40, 20), "red")
            exif = image.getexif()
            exif[274] = 6
            image.save(path, exif=exif)

            resize_photo(path)

            with Image.open(path) as normalized:
                self.assertEqual(normalized.size, (20, 40))
                self.assertNotIn(normalized.getexif().get(274), {6, 8})

    @patch("scripts.sync_airtable.MAX_PHOTO_DIMENSION", 30)
    def test_resizes_using_display_orientation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oriented.jpeg"
            image = Image.new("RGB", (40, 20), "blue")
            exif = image.getexif()
            exif[274] = 6
            image.save(path, exif=exif)

            resize_photo(path)

            with Image.open(path) as normalized:
                self.assertEqual(normalized.size, (15, 30))


class PhotoAspectRatioTests(unittest.TestCase):
    def test_compares_local_pixels_with_airtable_display_dimensions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "portrait.jpeg"
            Image.new("RGB", (1200, 1600), "green").save(path)

            self.assertTrue(photo_aspect_ratio_matches(path, {"width": 4284, "height": 5712}))
            self.assertFalse(photo_aspect_ratio_matches(path, {"width": 5712, "height": 4284}))


if __name__ == "__main__":
    unittest.main()
