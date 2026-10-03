"""Fine-tune a small image model on SurgWound infection-risk labels.

Training includes shrunk views of each wound so a photograph taken from
farther away can still be scored. No API key is required.
"""

import base64
import io
import json
import random
from pathlib import Path

import torch
from PIL import Image, ImageFilter
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "SurgWound"
OUT = Path(__file__).resolve().parent / "models" / "wound_risk.pt"
CLASSES = ["LOW", "MODERATE", "HIGH"]
LABEL_MAP = {
    "low": "LOW",
    "medium": "MODERATE",
    "moderate": "MODERATE",
    "high": "HIGH",
}


def load_split(name: str) -> list[tuple[Image.Image, int]]:
    rows = json.loads((DATA / name).read_text(encoding="utf-8"))
    samples = []
    for row in rows:
        if row.get("field") != "Infection Risk Assessment":
            continue
        label = LABEL_MAP.get(str(row.get("answer", "")).strip().lower())
        if label is None:
            continue
        raw = base64.b64decode(row["image"])
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        image.thumbnail((384, 384), Image.Resampling.BILINEAR)
        samples.append((image, CLASSES.index(label)))
    return samples


def farther_view(image: Image.Image) -> Image.Image:
    """Shrink the wound inside the frame, the way a longer camera distance looks."""
    if random.random() > 0.75:
        return image
    width, height = image.size
    scale = random.uniform(0.18, 0.72)
    small_w = max(12, int(width * scale))
    small_h = max(12, int(height * scale))
    wound = image.resize((small_w, small_h), Image.Resampling.BILINEAR)
    canvas = image.resize((width, height), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(radius=10))
    left = random.randint(0, width - small_w)
    top = random.randint(0, height - small_h)
    canvas.paste(wound, (left, top))
    return canvas


class WoundSet(Dataset):
    def __init__(self, samples: list[tuple[Image.Image, int]], train: bool, transform):
        self.samples = samples
        self.train = train
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        image, label = self.samples[index]
        if self.train:
            image = farther_view(image.copy())
            if random.random() < 0.5:
                image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        return self.transform(image), label


def accuracy(model, loader, device) -> float:
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)
            pred = model(images).argmax(dim=1)
            correct += int((pred == labels).sum())
            total += labels.shape[0]
    return correct / max(total, 1)


def main() -> None:
    random.seed(7)
    torch.manual_seed(7)
    device = torch.device("cpu")
    weights = EfficientNet_B0_Weights.DEFAULT
    transform = weights.transforms()
    train_samples = load_split("train_question.json")
    val_samples = load_split("val_question.json")
    print("train", len(train_samples), "val", len(val_samples))
    counts = [0, 0, 0]
    for _, label in train_samples:
        counts[label] += 1
    print("class counts LOW MODERATE HIGH", counts)

    class_weight = [1.0 / max(count, 1) for count in counts]
    sampler = WeightedRandomSampler(
        [class_weight[label] for _, label in train_samples],
        num_samples=len(train_samples) * 2,
        replacement=True,
    )
    train_loader = DataLoader(WoundSet(train_samples, True, transform), batch_size=16, sampler=sampler)
    val_loader = DataLoader(WoundSet(val_samples, False, transform), batch_size=16)

    model = efficientnet_b0(weights=weights)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(CLASSES))
    model.to(device)
    for parameter in model.features.parameters():
        parameter.requires_grad = False

    def run_epochs(epochs: int, learning_rate: float) -> None:
        optimizer = torch.optim.Adam((p for p in model.parameters() if p.requires_grad), lr=learning_rate)
        loss_fn = nn.CrossEntropyLoss(weight=torch.tensor(class_weight, dtype=torch.float32))
        for epoch in range(epochs):
            model.train()
            total_loss = 0.0
            for images, labels in train_loader:
                images = images.to(device)
                labels = labels.to(device)
                optimizer.zero_grad()
                loss = loss_fn(model(images), labels)
                loss.backward()
                optimizer.step()
                total_loss += float(loss) * labels.shape[0]
            score = accuracy(model, val_loader, device)
            print(f"epoch loss {total_loss / len(train_samples):.3f} val_acc {score:.3f}")

    run_epochs(2, 1e-3)
    for parameter in model.features.parameters():
        parameter.requires_grad = True
    run_epochs(3, 1e-4)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {"state_dict": model.state_dict(), "classes": CLASSES, "architecture": "efficientnet_b0"},
        OUT,
    )
    print("saved", OUT, "val_acc", f"{accuracy(model, val_loader, device):.3f}")


if __name__ == "__main__":
    main()
