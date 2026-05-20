export const EXERCISES: string[] = [
  // Chest
  "Bench Press", "Incline Bench Press", "Decline Bench Press",
  "Dumbbell Bench Press", "Incline Dumbbell Press", "Decline Dumbbell Press",
  "Dumbbell Flyes", "Incline Dumbbell Flyes", "Cable Flyes",
  "Chest Dips", "Push Up", "Wide Push Up", "Diamond Push Up",
  "Pec Deck", "Cable Crossover", "Landmine Press",

  // Back
  "Pull Up", "Chin Up", "Lat Pulldown", "Wide Grip Lat Pulldown",
  "Seated Cable Row", "Bent Over Row", "Dumbbell Row", "T-Bar Row",
  "Deadlift", "Romanian Deadlift", "Sumo Deadlift",
  "Face Pull", "Straight Arm Pulldown", "Hyperextension",
  "Rack Pull", "Meadows Row", "Chest Supported Row",

  // Shoulders
  "Overhead Press", "Dumbbell Shoulder Press", "Arnold Press",
  "Lateral Raise", "Dumbbell Lateral Raise", "Cable Lateral Raise",
  "Front Raise", "Dumbbell Front Raise", "Cable Front Raise",
  "Rear Delt Fly", "Dumbbell Rear Delt Fly", "Cable Rear Delt Fly",
  "Upright Row", "Shrugs", "Dumbbell Shrugs", "Face Pull",

  // Biceps
  "Barbell Curl", "Dumbbell Curl", "Hammer Curl",
  "Incline Dumbbell Curl", "Concentration Curl", "Preacher Curl",
  "Cable Curl", "EZ Bar Curl", "Reverse Curl", "Zottman Curl",
  "Cross Body Curl", "Spider Curl",

  // Triceps
  "Tricep Dips", "Close Grip Bench Press", "Skull Crushers",
  "Tricep Pushdown", "Cable Tricep Pushdown", "Rope Pushdown",
  "Overhead Tricep Extension", "Dumbbell Overhead Tricep Extension",
  "Tricep Kickback", "Diamond Push Up", "JM Press",

  // Forearms
  "Wrist Curl", "Reverse Wrist Curl", "Farmer's Walk",
  "Plate Pinch", "Dead Hang", "Reverse Curl",

  // Legs
  "Squat", "Back Squat", "Front Squat", "Goblet Squat",
  "Bulgarian Split Squat", "Leg Press", "Hack Squat",
  "Leg Extension", "Leg Curl", "Romanian Deadlift",
  "Stiff Leg Deadlift", "Good Morning", "Hip Thrust",
  "Glute Bridge", "Lunges", "Walking Lunges", "Reverse Lunges",
  "Step Up", "Calf Raise", "Seated Calf Raise", "Donkey Calf Raise",
  "Sumo Squat", "Box Squat", "Pistol Squat",

  // Abs
  "Crunch", "Sit Up", "Leg Raise", "Hanging Leg Raise",
  "Cable Crunch", "Russian Twist", "Plank", "Side Plank",
  "Ab Wheel Rollout", "Dragon Flag", "Toe To Bar",
  "Bicycle Crunch", "Mountain Climber", "V-Up",

  // Cardio
  "Treadmill", "Running", "Cycling", "Rowing Machine",
  "Jump Rope", "Stair Climber", "Elliptical", "Battle Ropes",
  "Burpees", "Box Jump",
];

export function searchExercises(query: string): string[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return EXERCISES.filter((ex) => ex.toLowerCase().includes(q)).slice(0, 8);
}