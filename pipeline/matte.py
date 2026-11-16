"""Cut a person out of images with BiRefNet-lite (MIT): writes RGBA PNGs.
Usage: .venv\\Scripts\\python.exe matte.py <model_dir> <out_dir> <image> [<image> ...]
"""
import os, sys, torch
import numpy as np
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

model_dir, out_dir, *paths = sys.argv[1:]
os.makedirs(out_dir, exist_ok=True)
model = AutoModelForImageSegmentation.from_pretrained(model_dir, trust_remote_code=True).to("cuda").eval().half()
tf = transforms.Compose([transforms.Resize((1024, 1024)), transforms.ToTensor(),
                         transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
for p in paths:
    img = Image.open(p).convert("RGB")
    with torch.no_grad():
        pred = model(tf(img).unsqueeze(0).to("cuda").half())[-1].sigmoid().float().cpu()[0, 0]
    a = Image.fromarray((pred.numpy() * 255).astype(np.uint8)).resize(img.size, Image.LANCZOS)
    out = img.convert("RGBA"); out.putalpha(a)
    out.save(os.path.join(out_dir, os.path.splitext(os.path.basename(p))[0] + ".png"))
print("matted", len(paths), flush=True)
