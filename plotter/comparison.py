import matplotlib.pyplot as plt

# 1. Define coordinates for both starting pairs
# Pair 1: Mean distance
mean_left = (-0.11322581,-3.47435484)
mean_right = (0.31451613,-3.69306452)

# Pair 2: Distance optimised
opt_left = (-0.06629198,-3.30452183)
opt_right = (0.28901512,-3.43451062)

# 2. Set up the Cartesian plane (-3 to 3 on X, -7 to 0 on Y)
fig, ax = plt.subplots(figsize=(7, 8))
ax.set_xlim(-3, 3)
ax.set_ylim(-7, 0)
ax.set_aspect('equal', adjustable='box')

# 3. Position spines centered at origin (0, 0)
ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_color('none')
ax.spines['top'].set_color('none')
ax.grid(True, which='both', linestyle='--', linewidth=0.5, alpha=0.7)

# 4. Plot Mean Distance Pair
ax.plot(
    [mean_left[0], mean_right[0]],
    [mean_left[1], mean_right[1]],
    color='royalblue',
    linestyle='--',
    linewidth=2,
    zorder=3
)
ax.scatter(
    [mean_left[0], mean_right[0]],
    [mean_left[1], mean_right[1]],
    color='deepskyblue',
    edgecolor='black',
    linewidth=1.5,
    s=100,
    marker='*',
    zorder=4,
    label='Mean Distance'
)

# 5. Plot Distance Optimised Pair
ax.plot(
    [opt_left[0], opt_right[0]],
    [opt_left[1], opt_right[1]],
    color='darkorange',
    linestyle='--',
    linewidth=2,
    zorder=3
)
ax.scatter(
    [opt_left[0], opt_right[0]],
    [opt_left[1], opt_right[1]],
    color='orangered',
    edgecolor='black',
    linewidth=1.5,
    s=100,
    marker='*',
    zorder=4,
    label='Distance Optimised'
)

# 6. Finalize layout and legend
ax.legend(loc='upper right', framealpha=0.9)
plt.show()