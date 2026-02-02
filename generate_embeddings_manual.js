// Manual script to generate expert embeddings
// Since we need to call the edge function with proper auth, we'll create expert embeddings manually

const experts = [
  {
    id: "42c4c836-38ad-4465-ab1c-657c7dfb9c7e", // Francie
    name: "Francie",
    bio: "International Board Certified Lactation Consultant (IBCLC), founder of Go Milk Yourself, a mom of 3, author, and former middle school teacher. As an IBCLC, she provides lactation care before and after the birth of new babies, supporting you throughout your journey. She is committed to meeting you exactly where you are, and then working with you to close the gaps so that your feeding experience is supported and effective.",
    specialties: ["Breastfeeding"],
    credentials: ["IBCLC"],
    experience: "10+ years",
  },
  {
    id: "7307ba82-72a8-43e2-aa53-7ce353074033", // Haley
    name: "Haley",
    bio: "Dr. Haley Timbrook is a pediatric and family chiropractor who helps parents and children feel more aligned—physically and energetically—through every stage of development. As the owner of At Last Chiropractic, she brings a gentle, holistic approach to nervous system regulation, supporting everything from infant tension and latch challenges to postpartum recovery and family wellness.",
    specialties: ["Pediatric & Family Chiropractor"],
    credentials: ["Doctor of Chiropractic"],
    experience: "8+ years",
  },
  {
    id: "9fff58a4-e0fb-4c75-8773-8a2b31a1eb45", // Karen
    name: "Karen",
    bio: "Lifestyle coach who specializes in helping individuals and families navigate the emotional and identity shifts that come with postpartum life and family expansion. With a background in wellness and somatic practices, she brings a grounded, compassionate presence to her work. Karen offers practical tools and personalized support to help clients find balance, confidence, and clarity during this transformative season.",
    specialties: ["Family Dynamics"],
    credentials: ["Certified Lifestyle Coach"],
    experience: "6+ years",
  },
];

// console.log("Expert embeddings that need to be generated:");
experts.forEach((expert) => {
  const profileText = [
    `Expert: ${expert.name}`,
    `Bio: ${expert.bio}`,
    `Specialties: ${expert.specialties.join(", ")}`,
    `Credentials: ${expert.credentials.join(", ")}`,
    `Experience: ${expert.experience}`,
  ].join("\n");

  // console.log(`\n--- ${expert.name} ---`);
  // console.log(`ID: ${expert.id}`);
  // console.log(`Profile Text for Embedding:\n${profileText}`);
});

// console.log("\n\nTo generate these embeddings, we need to:");
// console.log(
//   "1. Call the OpenAI API to create embeddings for each profile text",
// );
// console.log("2. Insert the embeddings into the expert_embeddings table");
// console.log(
//   "3. This should be done via the generate_expert_embeddings edge function",
// );
