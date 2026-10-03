from django.db import models


class Pattern(models.Model):
    name = models.CharField(max_length=48)
    bpm = models.PositiveSmallIntegerField(default=140)
    swing = models.PositiveSmallIntegerField(default=12)
    steps = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name