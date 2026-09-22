import pandas as pd
import matplotlib.pyplot as plt

# 1. Read the dataset
df = pd.read_csv('data.csv')

# --- Define the new accent starting pair coordinates ---
start_left = (-0.11322581,-3.47435484)
start_right = (0.31451613,-3.69306452)

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

# 4. Draw dotted lines between each existing Left-Right pair
for _, row in df.iterrows():
    ax.plot(
        [row['Left X'], row['Right X']],
        [row['Left Y'], row['Right Y']],
        color='gray',
        linestyle=':',
        linewidth=0.8,
        zorder=1
    )

# 5. Scatter plot standard Left points (blue) and Right points (red)
ax.scatter(df['Left X'], df['Left Y'], color='blue', label='Left', zorder=2, s=12)
ax.scatter(df['Right X'], df['Right Y'], color='red', label='Right', zorder=2,s=12)

# --- 6. Add Accentuated Starting Pair ---
# Line connecting start points
ax.plot(
    [start_left[0], start_right[0]],
    [start_left[1], start_right[1]],
    color='black',
    linestyle='--',
    linewidth=2,
    zorder=3,
)

# Accentuated start points (star markers, larger size, black borders)
ax.scatter(
    start_left[0], start_left[1],
    color='deepskyblue', edgecolor='black', linewidth=1.5,
    s=200, marker='*', zorder=4, label='Start Left'
)
ax.scatter(
    start_right[0], start_right[1],
    color='orangered', edgecolor='black', linewidth=1.5,
    s=200, marker='*', zorder=4, label='Start Right'
)

ax.legend(loc='upper right', framealpha=0.9)
plt.show()