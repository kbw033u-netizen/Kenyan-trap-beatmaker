import json

from django.test import TestCase
from django.urls import reverse

from .models import Pattern


class PatternApiTests(TestCase):
    def setUp(self):
        self.steps = {track: [False] * 64 for track in ("kick", "snare", "hat", "log", "shaker")}
        self.steps["kick"][0] = True
        self.payload = {"name": "Nairobi bounce", "bpm": 140, "swing": 12, "steps": self.steps}

    def test_studio_loads(self):
        response = self.client.get(reverse("studio"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Find your")
        self.assertContains(response, 'id="detect-tempo-button"')
        self.assertContains(response, "studio/tempo.js")
        self.assertIn("csrftoken", response.cookies)

    def test_patterns_can_be_saved_and_listed(self):
        response = self.client.post(
            reverse("patterns"), data=json.dumps(self.payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["name"], "Nairobi bounce")
        self.assertEqual(Pattern.objects.count(), 1)
        self.assertEqual(self.client.get(reverse("patterns")).json()["patterns"][0]["steps"], self.steps)

    def test_numeric_step_values_are_rejected(self):
        self.payload["steps"]["kick"] = [1] + [0] * 63
        response = self.client.post(
            reverse("patterns"), data=json.dumps(self.payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_non_object_json_is_rejected(self):
        response = self.client.post(reverse("patterns"), data="[]", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_browser_save_requires_csrf_token(self):
        client = self.client_class(enforce_csrf_checks=True)
        client.get(reverse("studio"))
        response = client.post(
            reverse("patterns"), data=json.dumps(self.payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_step_grid_is_rejected(self):
        self.payload["steps"]["hat"] = [True, False]
        response = self.client.post(
            reverse("patterns"), data=json.dumps(self.payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Pattern.objects.count(), 0)

    def test_saved_pattern_can_be_deleted(self):
        pattern = Pattern.objects.create(**self.payload)
        response = self.client.delete(reverse("delete-pattern", args=[pattern.id]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Pattern.objects.filter(id=pattern.id).exists())