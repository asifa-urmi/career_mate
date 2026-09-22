import { PrismaClient, type JobCategory, type JobType, type WorkMode } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed data, ported from the prototype's twelve jobs.
 *
 * Every write is an upsert keyed on something stable, so running this twice does
 * not duplicate anything — which matters because it runs on every deploy that
 * calls it, not only the first.
 *
 * The employer accounts it creates are data-only: they own the jobs so the
 * foreign key resolves, but they have no Supabase auth user and therefore cannot
 * be signed into. Sign up normally to get a real account.
 */

type SeedCompany = {
  slug: string
  name: string
  initials: string
  sector: JobCategory
  size: string
  location: string
  about: string
  contactName: string
}

const COMPANIES: SeedCompany[] = [
  {
    slug: 'nexa-labs',
    name: 'Nexa Labs',
    initials: 'NL',
    sector: 'TECHNOLOGY',
    size: '11–50',
    location: 'Dhaka, Bangladesh',
    about: 'Product engineering team building backend services for growing companies.',
    contactName: 'Nexa Labs Hiring',
  },
  {
    slug: 'bluepeak',
    name: 'BluePeak Consumer',
    initials: 'BP',
    sector: 'MARKETING',
    size: '51–200',
    location: 'Dhaka, Bangladesh',
    about: 'Consumer brand group running retail and digital-first product lines.',
    contactName: 'BluePeak People',
  },
  {
    slug: 'meridian',
    name: 'Meridian Group',
    initials: 'MG',
    sector: 'FINANCE',
    size: '201–1000',
    location: 'Dhaka, Bangladesh',
    about: 'Diversified group with manufacturing, trading and financial services arms.',
    contactName: 'Meridian HR',
  },
  {
    slug: 'lumen',
    name: 'Lumen Services',
    initials: 'LS',
    sector: 'HR',
    size: '51–200',
    location: 'Dhaka, Bangladesh',
    about: 'Business services firm supporting people operations for mid-sized employers.',
    contactName: 'Lumen Talent',
  },
  {
    slug: 'northstar',
    name: 'Northstar Studio',
    initials: 'NS',
    sector: 'DESIGN',
    size: '11–50',
    location: 'Remote',
    about: 'Product design studio working with software teams across South Asia.',
    contactName: 'Northstar Studio',
  },
  {
    slug: 'growthgrid',
    name: 'GrowthGrid',
    initials: 'GG',
    sector: 'SALES',
    size: '11–50',
    location: 'Dhaka, Bangladesh',
    about: 'B2B sales acceleration team working with SaaS and services companies.',
    contactName: 'GrowthGrid Talent',
  },
  {
    slug: 'pathao-commerce',
    name: 'Pathao Commerce',
    initials: 'PC',
    sector: 'OPERATIONS',
    size: '201–1000',
    location: 'Dhaka, Bangladesh',
    about: 'Commerce and logistics operations serving retail partners nationwide.',
    contactName: 'Commerce People Ops',
  },
  {
    slug: 'novacare',
    name: 'NovaCare',
    initials: 'NC',
    sector: 'CUSTOMER_SUPPORT',
    size: '51–200',
    location: 'Remote',
    about: 'Customer experience team supporting subscription software products.',
    contactName: 'NovaCare Support Hiring',
  },
  {
    slug: 'greenlife',
    name: 'GreenLife Hospital',
    initials: 'GH',
    sector: 'HEALTHCARE',
    size: '201–1000',
    location: 'Dhaka, Bangladesh',
    about: 'Multi-specialty hospital with inpatient, outpatient and emergency services.',
    contactName: 'GreenLife Nursing Office',
  },
  {
    slug: 'brightpath',
    name: 'BrightPath School',
    initials: 'BS',
    sector: 'EDUCATION',
    size: '51–200',
    location: 'Narayanganj, Bangladesh',
    about: 'English-medium secondary school following a national and Cambridge blend.',
    contactName: 'BrightPath Academic Office',
  },
  {
    slug: 'axiom-ai',
    name: 'Axiom AI',
    initials: 'AI',
    sector: 'TECHNOLOGY',
    size: '1–10',
    location: 'Remote',
    about: 'Applied machine learning team working on document and language problems.',
    contactName: 'Axiom AI',
  },
  {
    slug: 'atlas',
    name: 'Atlas Manufacturing',
    initials: 'AM',
    sector: 'OPERATIONS',
    size: '1000+',
    location: 'Gazipur, Bangladesh',
    about: 'Manufacturing group supplying domestic and export markets.',
    contactName: 'Atlas Procurement HR',
  },
]

type SeedJob = {
  slug: string
  company: string
  title: string
  category: JobCategory
  location: string
  workMode: WorkMode
  jobType: JobType
  salaryMinBdt: number | null
  salaryMaxBdt: number | null
  salaryNote: string | null
  summary: string
  responsibilities: string[]
  requirements: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  daysAgo: number
}

const JOBS: SeedJob[] = [
  {
    slug: 'nexa-junior-backend-engineer',
    company: 'nexa-labs',
    title: 'Junior Backend Engineer',
    category: 'TECHNOLOGY',
    location: 'Dhaka',
    workMode: 'HYBRID',
    jobType: 'FULL_TIME',
    salaryMinBdt: 45000,
    salaryMaxBdt: 65000,
    salaryNote: null,
    summary: 'Build reliable APIs and backend services for a growing product team.',
    responsibilities: [
      'Develop and maintain REST APIs',
      'Work with PostgreSQL and production data flows',
      'Write tests and collaborate through code review',
      'Support deployment and monitoring workflows',
    ],
    requirements: [
      'Strong Python fundamentals',
      'Django or a similar web framework',
      'SQL and Git',
      'Good communication and problem solving',
    ],
    requiredSkills: ['Python', 'Django', 'REST API'],
    preferredSkills: ['Docker', 'Redis', 'Cloud deployment'],
    daysAgo: 0,
  },
  {
    slug: 'bluepeak-digital-marketing-executive',
    company: 'bluepeak',
    title: 'Digital Marketing Executive',
    category: 'MARKETING',
    location: 'Dhaka',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 35000,
    salaryMaxBdt: 50000,
    salaryNote: null,
    summary:
      'Plan campaigns, manage social channels and turn marketing data into growth actions.',
    responsibilities: [
      'Plan paid and organic campaigns',
      'Coordinate content calendars',
      'Track CAC, CTR and conversion metrics',
      'Prepare weekly performance reports',
    ],
    requirements: [
      'Hands-on social media marketing',
      'Basic copywriting and campaign analytics',
      'Excel or Google Sheets',
      'Clear communication',
    ],
    requiredSkills: ['Meta Ads', 'Content', 'Analytics'],
    preferredSkills: ['Meta Ads certification', 'Canva', 'GA4'],
    daysAgo: 0,
  },
  {
    slug: 'meridian-accounts-officer',
    company: 'meridian',
    title: 'Accounts Officer',
    category: 'FINANCE',
    location: 'Dhaka',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 38000,
    salaryMaxBdt: 55000,
    salaryNote: null,
    summary: 'Maintain accounts, support month-end closing and prepare accurate records.',
    responsibilities: [
      'Record daily transactions',
      'Prepare bank reconciliations',
      'Support VAT and tax documentation',
      'Assist month-end close',
    ],
    requirements: [
      'BBA or BCom in Accounting or Finance',
      'Strong Excel skills',
      'Knowledge of basic accounting standards',
      'Attention to detail',
    ],
    requiredSkills: ['Accounting', 'Excel', 'VAT/Tax'],
    preferredSkills: ['ERP experience', 'QuickBooks', 'Corporate accounting exposure'],
    daysAgo: 1,
  },
  {
    slug: 'lumen-hr-people-operations-executive',
    company: 'lumen',
    title: 'HR & People Operations Executive',
    category: 'HR',
    location: 'Dhaka',
    workMode: 'HYBRID',
    jobType: 'FULL_TIME',
    salaryMinBdt: 40000,
    salaryMaxBdt: 58000,
    salaryNote: null,
    summary:
      'Support recruitment, onboarding, employee records and day-to-day people operations.',
    responsibilities: [
      'Coordinate recruitment pipelines',
      'Run onboarding and employee documentation',
      'Maintain HRIS records',
      'Support engagement activities',
    ],
    requirements: [
      'Business or HR academic background',
      'Professional communication',
      'Excel or Sheets',
      'Confidential data handling',
    ],
    requiredSkills: ['Recruitment', 'HRIS', 'Employee Relations'],
    preferredSkills: ['HRIS tools', 'Labour law basics', 'Employer branding'],
    daysAgo: 1,
  },
  {
    slug: 'northstar-ui-ux-designer',
    company: 'northstar',
    title: 'UI/UX Designer',
    category: 'DESIGN',
    location: 'Remote',
    workMode: 'REMOTE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 55000,
    salaryMaxBdt: 80000,
    salaryNote: null,
    summary: 'Design accessible product experiences from research through interactive prototypes.',
    responsibilities: [
      'Create user flows and wireframes',
      'Build polished UI in Figma',
      'Prototype key interactions',
      'Collaborate with product and engineering',
    ],
    requirements: [
      'Strong portfolio',
      'Figma proficiency',
      'UX fundamentals',
      'Responsive design understanding',
    ],
    requiredSkills: ['Figma', 'UX Research', 'Prototyping'],
    preferredSkills: ['Design systems', 'Usability testing', 'Motion design'],
    daysAgo: 1,
  },
  {
    slug: 'growthgrid-sales-development-representative',
    company: 'growthgrid',
    title: 'Sales Development Representative',
    category: 'SALES',
    location: 'Dhaka',
    workMode: 'HYBRID',
    jobType: 'FULL_TIME',
    salaryMinBdt: 30000,
    salaryMaxBdt: 45000,
    salaryNote: 'incentive',
    summary:
      'Create qualified sales opportunities through research, outreach and disciplined CRM work.',
    responsibilities: [
      'Research target accounts',
      'Run outbound email and calls',
      'Qualify prospects',
      'Maintain CRM hygiene',
    ],
    requirements: [
      'Strong spoken communication',
      'Goal-oriented mindset',
      'Basic CRM familiarity',
      'Professional English and Bangla',
    ],
    requiredSkills: ['B2B Sales', 'CRM', 'Lead Generation'],
    preferredSkills: ['HubSpot', 'SaaS sales', 'LinkedIn prospecting'],
    daysAgo: 2,
  },
  {
    slug: 'pathao-operations-coordinator',
    company: 'pathao-commerce',
    title: 'Operations Coordinator',
    category: 'OPERATIONS',
    location: 'Dhaka',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 35000,
    salaryMaxBdt: 48000,
    salaryNote: null,
    summary: 'Coordinate daily operational workflows, vendors, reporting and issue resolution.',
    responsibilities: [
      'Track daily operational KPIs',
      'Coordinate vendors and internal teams',
      'Resolve escalations',
      'Prepare reports',
    ],
    requirements: [
      'Strong organisation',
      'Excel or Sheets',
      'Problem solving',
      'Comfort with fast-paced work',
    ],
    requiredSkills: ['Operations', 'Excel', 'Vendor Coordination'],
    preferredSkills: ['Logistics experience', 'Dashboard tools', 'Process documentation'],
    daysAgo: 2,
  },
  {
    slug: 'novacare-customer-support-specialist',
    company: 'novacare',
    title: 'Customer Support Specialist',
    category: 'CUSTOMER_SUPPORT',
    location: 'Remote',
    workMode: 'REMOTE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 28000,
    salaryMaxBdt: 42000,
    salaryNote: null,
    summary:
      'Help customers through chat, email and structured escalation while maintaining service quality.',
    responsibilities: [
      'Respond to customer queries',
      'Document cases in the CRM',
      'Escalate technical issues',
      'Track satisfaction and response SLA',
    ],
    requirements: [
      'Excellent written communication',
      'Empathy and patience',
      'Basic computer literacy',
      'Shift flexibility',
    ],
    requiredSkills: ['Customer Support', 'CRM', 'Communication'],
    preferredSkills: ['Zendesk', 'SaaS support', 'English fluency'],
    daysAgo: 3,
  },
  {
    slug: 'greenlife-registered-nurse',
    company: 'greenlife',
    title: 'Registered Nurse — General Ward',
    category: 'HEALTHCARE',
    location: 'Dhaka',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 32000,
    salaryMaxBdt: 50000,
    salaryNote: null,
    summary:
      'Provide safe patient care, maintain clinical documentation and coordinate with medical teams.',
    responsibilities: [
      'Provide bedside nursing care',
      'Record vitals and medication administration',
      'Maintain patient documentation',
      'Coordinate with doctors and attendants',
    ],
    requirements: [
      'Diploma or BSc in Nursing',
      'Valid professional registration',
      'Clinical communication',
      'Patient safety knowledge',
    ],
    requiredSkills: ['Patient Care', 'Nursing', 'Clinical Documentation'],
    preferredSkills: ['Ward experience', 'BLS certification', 'Hospital HIS familiarity'],
    daysAgo: 3,
  },
  {
    slug: 'brightpath-english-teacher',
    company: 'brightpath',
    title: 'English Teacher — Secondary',
    category: 'EDUCATION',
    location: 'Narayanganj',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 30000,
    salaryMaxBdt: 45000,
    salaryNote: null,
    summary:
      'Teach secondary-level English using structured lessons, assessment and student feedback.',
    responsibilities: [
      'Plan and deliver lessons',
      'Prepare assessments',
      'Provide student feedback',
      'Coordinate with the academic team',
    ],
    requirements: [
      'Relevant degree',
      'Strong English communication',
      'Classroom management',
      'Lesson planning',
    ],
    requiredSkills: ['Teaching', 'Lesson Planning', 'Assessment'],
    preferredSkills: ['B.Ed', 'EdTech tools', 'Cambridge curriculum exposure'],
    daysAgo: 4,
  },
  {
    slug: 'axiom-machine-learning-intern',
    company: 'axiom-ai',
    title: 'Machine Learning Intern',
    category: 'TECHNOLOGY',
    location: 'Remote',
    workMode: 'REMOTE',
    jobType: 'INTERNSHIP',
    salaryMinBdt: 25000,
    salaryMaxBdt: 35000,
    salaryNote: null,
    summary: 'Support practical ML experiments, data preparation and model evaluation.',
    responsibilities: [
      'Prepare datasets',
      'Train baseline models',
      'Evaluate experiments',
      'Document findings',
    ],
    requirements: ['Python', 'ML fundamentals', 'Pandas and NumPy', 'A learning mindset'],
    requiredSkills: ['Python', 'Scikit-learn', 'Pandas'],
    preferredSkills: ['PyTorch', 'Kaggle', 'MLOps basics'],
    daysAgo: 5,
  },
  {
    slug: 'atlas-procurement-executive',
    company: 'atlas',
    title: 'Procurement Executive',
    category: 'OPERATIONS',
    location: 'Gazipur',
    workMode: 'ONSITE',
    jobType: 'FULL_TIME',
    salaryMinBdt: 42000,
    salaryMaxBdt: 60000,
    salaryNote: null,
    summary:
      'Manage sourcing, purchase documentation, vendor follow-up and procurement reporting.',
    responsibilities: [
      'Source suppliers',
      'Prepare comparative statements',
      'Track purchase orders',
      'Maintain vendor records',
    ],
    requirements: ['Business degree', 'Negotiation', 'Excel', 'Documentation discipline'],
    requiredSkills: ['Procurement', 'Vendor Management', 'ERP'],
    preferredSkills: ['ERP', 'Manufacturing procurement', 'Import documentation'],
    daysAgo: 6,
  },
]

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

async function main() {
  console.log('Seeding CareerMate…')

  const companyIdBySlug = new Map<string, string>()
  const employerIdBySlug = new Map<string, string>()

  for (const c of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { name: c.name },
      create: {
        name: c.name,
        logoInitials: c.initials,
        sector: c.sector,
        size: c.size,
        location: c.location,
        about: c.about,
        verified: true,
      },
      update: { logoInitials: c.initials, sector: c.sector, about: c.about, verified: true },
      select: { id: true },
    })
    companyIdBySlug.set(c.slug, company.id)

    // Data-only owner: the job's postedBy foreign key needs a user, but this row
    // has no Supabase auth identity so it cannot be signed into.
    const userId = `seed-employer-${c.slug}`
    const user = await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `hiring@${c.slug}.seed.careermate.local`,
        name: c.contactName,
        role: 'EMPLOYER',
        onboardedAt: new Date(),
      },
      update: { name: c.contactName },
      select: { id: true },
    })

    await prisma.employerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, companyId: company.id, title: 'Hiring team' },
      update: { companyId: company.id },
    })

    employerIdBySlug.set(c.slug, user.id)
  }

  console.log(`  ${COMPANIES.length} companies`)

  for (const j of JOBS) {
    const companyId = companyIdBySlug.get(j.company)
    const postedById = employerIdBySlug.get(j.company)
    if (!companyId || !postedById) throw new Error(`Unknown company for job ${j.slug}`)

    const publishedAt = daysAgo(j.daysAgo)

    // Jobs have no natural unique key, so the seed keys on title + company —
    // enough to make a second run update rather than duplicate.
    const existing = await prisma.job.findFirst({
      where: { companyId, title: j.title },
      select: { id: true },
    })

    const data = {
      companyId,
      postedById,
      title: j.title,
      category: j.category,
      location: j.location,
      workMode: j.workMode,
      jobType: j.jobType,
      salaryMinBdt: j.salaryMinBdt,
      salaryMaxBdt: j.salaryMaxBdt,
      salaryNote: j.salaryNote,
      summary: j.summary,
      responsibilities: j.responsibilities,
      requirements: j.requirements,
      requiredSkills: j.requiredSkills,
      preferredSkills: j.preferredSkills,
      status: 'PUBLISHED' as const,
      moderation: 'APPROVED' as const,
      publishedAt,
    }

    if (existing) {
      await prisma.job.update({ where: { id: existing.id }, data })
    } else {
      await prisma.job.create({ data })
    }
  }

  console.log(`  ${JOBS.length} jobs`)

  const [companies, jobs, users] = await Promise.all([
    prisma.company.count(),
    prisma.job.count(),
    prisma.user.count(),
  ])

  console.log(`Done. ${companies} companies, ${jobs} jobs, ${users} users in the database.`)
  console.log('')
  console.log('Seeded employer accounts cannot be signed into — they have no Supabase auth')
  console.log('identity. Create your own account through /signup.')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
