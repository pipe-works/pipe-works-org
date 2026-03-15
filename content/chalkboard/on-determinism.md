---
title: On Determinism
strapline: Same seed, same world. No exceptions.
date: 2026-03-15
---

## The Argument

A world that changes when nobody is looking is not a world. It is a mood.

Determinism is not a constraint — it is a **promise**. Given the same seed,
the same name is minted, the same quirks are assigned, the same room is
built in the same order with the same leaky pipe in the corner.

This matters because:

- Players can return and find what they left.
- Bugs can be reproduced by replaying a seed.
- The system's authority is auditable, not mystical.

## The Practice

Every generator in the Pipe-Works ecosystem uses an **isolated RNG instance**,
never the global random state:

```python
rng = random.Random(seed)
name = rng.choice(syllables)
```

Global state is shared state. Shared state is contested ground.
Contested ground produces surprises that nobody asked for.

## Marginal Note

*If your world needs a coin flip to exist, it was never really there.*
