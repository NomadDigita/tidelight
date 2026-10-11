"""Run with: blender --background ../assets/tide/Tide_Original_3D_Asset.blend --python render_tide_anim.py"""
import bpy
from pathlib import Path
import os
root = Path(__file__).resolve().parents[2]
output = root / "assets" / "tide" / "renders" / "tide_anim"
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 540
scene.render.resolution_y = 810
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 150
scene.render.filepath = str(output / "frame_")
bpy.ops.render.render(animation=True)
