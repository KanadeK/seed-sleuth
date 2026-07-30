import { WORLD_FORMAT, WORLD_SCHEMA_VERSION } from "../../src/constants.js";

function createRng(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function randomInteger(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function overlaps(left, right) {
  return !(
    left.x + left.width + 1 < right.x ||
    right.x + right.width + 1 < left.x ||
    left.y + left.height + 1 < right.y ||
    right.y + right.height + 1 < left.y
  );
}

function carveRoom(grid, room) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      grid[y][x] = ".";
    }
  }
}

function carveHorizontal(grid, fromX, toX, y) {
  const start = Math.min(fromX, toX);
  const end = Math.max(fromX, toX);
  for (let x = start; x <= end; x += 1) {
    grid[y][x] = ".";
  }
}

function carveVertical(grid, fromY, toY, x) {
  const start = Math.min(fromY, toY);
  const end = Math.max(fromY, toY);
  for (let y = start; y <= end; y += 1) {
    grid[y][x] = ".";
  }
}

function connectRooms(grid, left, right, random, mode) {
  const horizontalDistance = Math.abs(right.centerX - left.centerX);
  const verticalDistance = Math.abs(right.centerY - left.centerY);

  if (mode === "faulty") {
    // Representative production bug: the horizontal half is always carved,
    // while the vertical half is accidentally skipped for steep connections.
    carveHorizontal(grid, left.centerX, right.centerX, left.centerY);
    if (verticalDistance <= horizontalDistance) {
      carveVertical(grid, left.centerY, right.centerY, right.centerX);
    }
    return;
  }

  if (random() < 0.5) {
    carveHorizontal(grid, left.centerX, right.centerX, left.centerY);
    carveVertical(grid, left.centerY, right.centerY, right.centerX);
  } else {
    carveVertical(grid, left.centerY, right.centerY, left.centerX);
    carveHorizontal(grid, left.centerX, right.centerX, right.centerY);
  }
}

function makeRoom(random, width, height) {
  const roomWidth = randomInteger(random, 3, 7);
  const roomHeight = randomInteger(random, 3, 6);
  const x = randomInteger(random, 1, width - roomWidth - 2);
  const y = randomInteger(random, 1, height - roomHeight - 2);
  return {
    x,
    y,
    width: roomWidth,
    height: roomHeight,
    centerX: x + Math.floor(roomWidth / 2),
    centerY: y + Math.floor(roomHeight / 2),
  };
}

export function generate(seed, options = {}) {
  const width = options.width ?? 31;
  const height = options.height ?? 21;
  const roomTarget = options.rooms ?? 7;
  const mode = options.mode ?? "healthy";
  const random = createRng(seed);
  const grid = Array.from({ length: height }, () => Array(width).fill("#"));
  const rooms = [];

  for (
    let attempt = 0;
    attempt < roomTarget * 30 && rooms.length < roomTarget;
    attempt += 1
  ) {
    const room = makeRoom(random, width, height);
    if (rooms.every((candidate) => !overlaps(room, candidate))) {
      rooms.push(room);
      carveRoom(grid, room);
    }
  }

  if (rooms.length < 3) {
    throw new Error(`Generator placed only ${rooms.length} rooms.`);
  }

  const startRoom = rooms[0];
  let farthestIndex = 1;
  let farthestDistance = -1;
  for (let index = 1; index < rooms.length; index += 1) {
    const distance =
      Math.abs(rooms[index].centerX - startRoom.centerX) +
      Math.abs(rooms[index].centerY - startRoom.centerY);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  [rooms[farthestIndex], rooms[rooms.length - 1]] = [
    rooms[rooms.length - 1],
    rooms[farthestIndex],
  ];

  for (let index = 1; index < rooms.length; index += 1) {
    connectRooms(grid, rooms[index - 1], rooms[index], random, mode);
  }

  const exitRoom = rooms[rooms.length - 1];
  grid[startRoom.centerY][startRoom.centerX] = "S";
  grid[exitRoom.centerY][exitRoom.centerX] = "E";

  return {
    format: WORLD_FORMAT,
    schemaVersion: WORLD_SCHEMA_VERSION,
    seed,
    width,
    height,
    cells: grid.map((row) => row.join("")),
    metadata: {
      algorithm: "rooms-and-corridors",
      mode,
      roomCount: rooms.length,
    },
  };
}
