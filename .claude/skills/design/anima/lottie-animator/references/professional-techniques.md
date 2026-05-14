# Professional Lottie Animation Techniques

Advanced techniques from analysis of professional animations (Running Cat, etc.).

## 1. Frame-by-Frame Animation (Sprite Sheet Style)

The most professional technique for complex character animations.

### Concept

Instead of animating properties continuously, create multiple **"poses"** that appear/disappear in sequence.

```
Frame 0-6:   Pose 1 (visible)
Frame 6-12:  Pose 2 (visible)
Frame 12-18: Pose 3 (visible)
...
```

### JSON Structure

```json
{
  "layers": [
    {
      "nm": "Cat Pose 1",
      "ip": 0,    // In Point: appears frame 0
      "op": 6,    // Out Point: disappears frame 6
      "shapes": [/* Cat in pose 1 */]
    },
    {
      "nm": "Cat Pose 2",
      "ip": 6,    // Appears frame 6
      "op": 12,   // Disappears frame 12
      "shapes": [/* Cat in pose 2 */]
    },
    {
      "nm": "Cat Pose 3",
      "ip": 12,
      "op": 18,
      "shapes": [/* Cat in pose 3 */]
    }
  ]
}
```

### Advantages

- **Total freedom**: Each pose can have completely different shapes
- **No same vertex count required**: Unlike morphing
- **More organic**: Better for complex character animations
- **Professional**: Technique used in high-quality animations

### When to Use

- Walk cycles of characters
- Run cycles
- Animations with drastic shape changes
- When morphing produces ugly results

### Frame Calculation

```
Total Frames = (Number of Poses) × (Frames per Pose)
Duration (seconds) = Total Frames / Frame Rate

Example Running Cat:
- 6 poses × 6 frames = 36 frames total
- 36 frames / 60 fps = 0.6 seconds loop
```

---

## 2. Parenting Hierarchy (Bone System)

Parent-child hierarchy system for coordinated animations.

### Concept

A "parent" layer controls the position/rotation of multiple "children".

```
Shadow (Parent Layer 14)
├── Head (child)
├── Body (child)
├── Ear Inner (child)
├── Eye (child)
├── Nose (child)
└── ...13 total children
```

### JSON Structure

```json
{
  "layers": [
    {
      "ind": 14,
      "nm": "Shadow",
      "ty": 4,
      "ks": {
        "p": {"a": 0, "k": [340, 195, 0]}
      }
    },
    {
      "ind": 1,
      "nm": "Head",
      "parent": 14,
      "ty": 4,
      "ks": {
        "p": {"a": 0, "k": [88, -84, 0]}  // RELATIVE position to parent
      }
    },
    {
      "ind": 2,
      "nm": "Eye",
      "parent": 14,
      "ty": 4,
      "ks": {
        "p": {"a": 0, "k": [64, -86, 0]}
      }
    }
  ]
}
```

### Practical Uses

1. **Shadow as Parent**: Move shadow → entire character moves
2. **Body as Parent**: Move body → head and limbs follow
3. **Upper Arm as Parent**: Rotate shoulder → forearm and hand rotate

### Benefits

- Move one layer → all children follow
- Easy to coordinate complex animations
- Reduces required keyframes

---

## 3. Stroke + Fill Combination (Outline Style)

Visual style with defined contours.

### Concept

Each shape has **fill + stroke (contour)**.

```json
{
  "shapes": [
    {
      "ty": "gr",
      "it": [
        {"ty": "sh", "ks": {...}},
        {"ty": "st",
          "c": {"a": 0, "k": [0.259, 0.153, 0.141, 1]},
          "w": {"a": 0, "k": 1},
          "lc": 2,
          "lj": 2
        },
        {"ty": "fl",
          "c": {"a": 0, "k": [0.302, 0.604, 0.816, 1]}
        },
        {"ty": "tr", ...}
      ]
    }
  ]
}
```

### Stroke Properties

| Property | Value | Description |
|----------|-------|-------------|
| `lc` (lineCap) | 1 | Butt (cut) |
| `lc` | 2 | Round |
| `lc` | 3 | Square |
| `lj` (lineJoin) | 1 | Miter (point) |
| `lj` | 2 | Round |
| `lj` | 3 | Bevel |

### Professional Color Palette (Running Cat)

```json
{
  "body_fill": [0.302, 0.604, 0.816, 1],
  "outline": [0.259, 0.153, 0.141, 1],
  "eye_white": [0.902, 0.976, 1.0, 1],
  "ear_inner": [0.941, 0.757, 0.686, 1],
  "shadow": [0.608, 0.706, 0.878, 1]
}
```

---

## 4. Bezier Paths with Tangents

Smooth paths using bezier curves.

### Path Structure

```json
{
  "ty": "sh",
  "ks": {
    "a": 0,
    "k": {
      "c": true,
      "v": [[0, 0], [100, 0], [100, 100], [0, 100]],
      "i": [[0, -10], [10, 0], [0, 10], [-10, 0]],
      "o": [[10, 0], [0, 10], [-10, 0], [0, -10]]
    }
  }
}
```

### Tangents

- `"i"` (in tangent): Control point ENTERING the vertex
- `"o"` (out tangent): Control point LEAVING the vertex
- Values are **RELATIVE** to the vertex
- `[0, 0]` = no curve (straight line)

---

## 5. Pre-compositions (Assets)

Group complex animations into reusable compositions.

### Structure

```json
{
  "assets": [
    {
      "id": "comp_0",
      "nm": "Cat Animation",
      "fr": 60,
      "layers": [/* 82 cat layers */]
    }
  ],
  "layers": [
    {
      "ty": 0,
      "refId": "comp_0",
      "nm": "Cat",
      "ip": 0,
      "op": 36
    }
  ]
}
```

---

## 6. Professional Timing

### Frame Rate and Duration

| Type | FPS | Frames | Duration | Use |
|------|-----|--------|----------|-----|
| Fast loop | 60 | 36 | 0.6s | Run cycles |
| Normal loop | 30 | 24 | 0.8s | Walk cycles |
| Slow loop | 30 | 60 | 2.0s | Idle animations |
| Transition | 60 | 45 | 0.75s | Entrances |

### Perfect Loop Structure

```
Frame 0: State A
...
Frame N-1: State A' (almost equal to A)
Frame N: [Returns to Frame 0]
```

**Key**: The last frame (op) is NOT rendered, it only marks the loop point.

---

## 7. Layer Order = Z-Depth

The order of layers in the array determines visual depth.

```json
{
  "layers": [
    {"ind": 1, "nm": "Background"},  // Furthest back (renders first)
    {"ind": 2, "nm": "Character"},
    {"ind": 3, "nm": "Foreground"}   // Furthest forward (renders last)
  ]
}
```

---

## Professional Animation Checklist

- [ ] Define number of poses for frame-by-frame
- [ ] Calculate timing: poses × frames_per_pose / fps = duration
- [ ] Establish parent-child hierarchy
- [ ] Use stroke + fill for outline style
- [ ] Coherent color palette (max 5-6 colors)
- [ ] Shadow pulses with steps
- [ ] Seamless loop (frame 0 ≈ final frame state)
- [ ] Test in LottieFiles Preview
