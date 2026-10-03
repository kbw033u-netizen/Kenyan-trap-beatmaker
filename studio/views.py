import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .models import Pattern

TRACKS = ("kick", "snare", "hat", "log", "shaker")
STEP_COUNT = 64


@ensure_csrf_cookie
def studio(request):
    return render(request, "studio/index.html")


def pattern_data(pattern):
    return {
        "id": pattern.id,
        "name": pattern.name,
        "bpm": pattern.bpm,
        "swing": pattern.swing,
        "steps": pattern.steps,
        "created_at": pattern.created_at.isoformat(),
    }


@require_http_methods(["GET", "POST"])
def patterns(request):
    if request.method == "GET":
        return JsonResponse({"patterns": [pattern_data(item) for item in Pattern.objects.all()]})

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Send valid JSON."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "Send a JSON object."}, status=400)

    name = payload.get("name", "")
    if not isinstance(name, str):
        return JsonResponse({"error": "Name must be text."}, status=400)
    name = name.strip()
    bpm = payload.get("bpm")
    swing = payload.get("swing")
    steps = payload.get("steps")
    if not name or len(name) > 48:
        return JsonResponse({"error": "Name must be between 1 and 48 characters."}, status=400)
    if type(bpm) is not int or not 60 <= bpm <= 200:
        return JsonResponse({"error": "Tempo must be between 60 and 200 BPM."}, status=400)
    if type(swing) is not int or not 0 <= swing <= 60:
        return JsonResponse({"error": "Swing must be between 0 and 60."}, status=400)
    if not isinstance(steps, dict) or set(steps) != set(TRACKS):
        return JsonResponse({"error": "Pattern must include all five tracks."}, status=400)
    if any(
        not isinstance(steps[track], list)
        or len(steps[track]) != STEP_COUNT
        or any(type(step) is not bool for step in steps[track])
        for track in TRACKS
    ):
        return JsonResponse({"error": "Each track must contain 64 on/off steps."}, status=400)

    pattern = Pattern.objects.create(name=name, bpm=bpm, swing=swing, steps=steps)
    return JsonResponse(pattern_data(pattern), status=201)


@require_http_methods(["DELETE"])
def delete_pattern(request, pattern_id):
    deleted, _ = Pattern.objects.filter(id=pattern_id).delete()
    if not deleted:
        return JsonResponse({"error": "Pattern not found."}, status=404)
    return JsonResponse({"deleted": True})