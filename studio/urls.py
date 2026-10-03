from django.urls import path

from . import views

urlpatterns = [
    path("", views.studio, name="studio"),
    path("api/patterns/", views.patterns, name="patterns"),
    path("api/patterns/<int:pattern_id>/", views.delete_pattern, name="delete-pattern"),
]