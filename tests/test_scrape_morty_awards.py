import unittest
from unittest.mock import call, patch

from scripts.scrape_morty_awards import normalize_award_identity, update_award_rooms


class NormalizeAwardIdentityTests(unittest.TestCase):
    def test_normalizes_golden_lock_title_variants(self):
        self.assertEqual(
            normalize_award_identity(
                "Golden Lock Awards",
                "Escape Room - Golden Lock Winners",
                "https://roomescapeartist.com/",
            ),
            ("Golden Lock Awards", "Winners"),
        )

    def test_normalizes_golden_lock_real_life_category(self):
        self.assertEqual(
            normalize_award_identity(
                "Golden Lock Awards",
                "Real-Life",
                "https://roomescapeartist.com/2022-golden-lock-awards/",
            ),
            ("Golden Lock Awards", "Winners"),
        )

    def test_infers_escape_room_awards_from_its_link(self):
        self.assertEqual(
            normalize_award_identity(
                "",
                "Best International Room",
                "https://www.escaperoomawardsoficial.com/awards",
            ),
            ("Escape Room Awards", "Best International"),
        )

    def test_does_not_infer_organization_from_a_lookalike_domain(self):
        self.assertEqual(
            normalize_award_identity(
                "",
                "Best International Room",
                "https://notescaperoomawardsoficial.com/awards",
            ),
            ("", "Best International Room"),
        )

    def test_normalizes_morty_international_award_typo(self):
        self.assertEqual(
            normalize_award_identity(
                "",
                "Best Intermational Escape Room",
                "https://escaperoomawardsoficial.com/awards",
            ),
            ("Escape Room Awards", "Best International"),
        )

    def test_leaves_other_awards_unchanged(self):
        self.assertEqual(
            normalize_award_identity("TERPECA", "Top Rooms", "https://terpeca.com/"),
            ("TERPECA", "Top Rooms"),
        )


class UpdateAwardRoomsTests(unittest.TestCase):
    @patch("scripts.scrape_morty_awards.airtable_request")
    def test_merges_against_live_airtable_record(self, request):
        request.side_effect = [
            {"fields": {"Rooms": ["recExisting", "recAlreadyLinked"]}},
            {},
        ]

        result = update_award_rooms(
            "appBase", "patToken", "recAward", {"recAlreadyLinked", "recNew"}
        )

        self.assertEqual(result, ["recExisting", "recAlreadyLinked", "recNew"])
        url = "https://api.airtable.com/v0/appBase/Awards/recAward"
        self.assertEqual(
            request.call_args_list,
            [
                call(url, "patToken"),
                call(
                    url,
                    "patToken",
                    method="PATCH",
                    payload={"fields": {"Rooms": ["recExisting", "recAlreadyLinked", "recNew"]}},
                ),
            ],
        )


if __name__ == "__main__":
    unittest.main()
