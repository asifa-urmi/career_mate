import type {
  ApplicationStage,
  ExperienceLevel,
  JobCategory,
  PrismaClient,
} from '@prisma/client'

/**
 * Demo candidates, and the applications that make the employer side worth
 * looking at.
 *
 * Without these, a fresh deployment shows an employer an empty pipeline, an
 * analytics page of zeroes and a candidate list with nothing in it — which looks
 * broken rather than new.
 *
 * Like the seeded employers, these accounts are data-only. They own profiles and
 * applications so the foreign keys resolve, but they have no Supabase auth
 * identity and cannot be signed into. Their addresses end in a `.local` domain
 * that cannot receive mail, so nothing here can be mistaken for a real person or
 * used to reach one.
 *
 * Everything is keyed on a stable id and upserted, so running the seed twice
 * updates rather than duplicates.
 */

type SeedCandidate = {
  slug: string
  name: string
  headline: string
  location: string
  bio: string
  experienceLevel: ExperienceLevel
  primarySector: JobCategory
  skills: string[]
  experience: { title: string; company: string; years: number; description: string }
  education: { degree: string; institution: string }
}

const CANDIDATES: SeedCandidate[] = [
  {
    slug: 'arif-hossain',
    name: 'Arif Hossain',
    headline: 'Backend developer working in Python and Django',
    location: 'Dhaka',
    bio: 'Two years building internal tools for a logistics company. Most of my work is API design and keeping a Postgres database honest.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'TECHNOLOGY',
    skills: ['Python', 'Django', 'PostgreSQL', 'REST API', 'Git'],
    experience: {
      title: 'Software Engineer',
      company: 'ShipHub BD',
      years: 2,
      description: 'Built and maintained the order API used by three internal teams.',
    },
    education: { degree: 'BSc in Computer Science', institution: 'BRAC University' },
  },
  {
    slug: 'nusrat-jahan',
    name: 'Nusrat Jahan',
    headline: 'Digital marketer focused on paid social and content',
    location: 'Dhaka',
    bio: 'I run Meta and Google campaigns for consumer brands and report on what actually moved, not what looked good in a deck.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'MARKETING',
    skills: ['Meta Ads', 'Google Ads', 'Content', 'Analytics', 'Copywriting'],
    experience: {
      title: 'Marketing Executive',
      company: 'Rangs Retail',
      years: 3,
      description: 'Managed a monthly ad budget of BDT 4 lakh across Meta and Google.',
    },
    education: { degree: 'BBA in Marketing', institution: 'North South University' },
  },
  {
    slug: 'tanvir-ahmed',
    name: 'Tanvir Ahmed',
    headline: 'Accounts officer with corporate finance experience',
    location: 'Dhaka',
    bio: 'Three years in accounts payable and monthly closing for a manufacturing group. Comfortable with VAT filing and reconciliation.',
    experienceLevel: 'THREE_TO_FIVE',
    primarySector: 'FINANCE',
    skills: ['Excel', 'Tally', 'VAT', 'Reconciliation', 'Accounts Payable'],
    experience: {
      title: 'Accounts Officer',
      company: 'Nitol Group',
      years: 4,
      description: 'Owned monthly closing and VAT returns for two business units.',
    },
    education: { degree: 'BBA in Accounting', institution: 'University of Dhaka' },
  },
  {
    slug: 'sadia-rahman',
    name: 'Sadia Rahman',
    headline: 'HR generalist — recruitment and onboarding',
    location: 'Dhaka',
    bio: 'I have hired across engineering and operations, and I care most about making the first month feel deliberate rather than improvised.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'HR',
    skills: ['Recruitment', 'Onboarding', 'HRIS', 'Interviewing'],
    experience: {
      title: 'HR Executive',
      company: 'Aamra Technologies',
      years: 2,
      description: 'Ran end-to-end hiring for 20 roles across two departments.',
    },
    education: { degree: 'BBA in Human Resource Management', institution: 'IBA, Dhaka' },
  },
  {
    slug: 'rakib-islam',
    name: 'Rakib Islam',
    headline: 'Product designer working in Figma',
    location: 'Chattogram',
    bio: 'I design mobile-first interfaces for local fintech products and run the usability sessions myself.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'DESIGN',
    skills: ['Figma', 'UI Design', 'Prototyping', 'User Research', 'Design Systems'],
    experience: {
      title: 'Product Designer',
      company: 'Praava Digital',
      years: 3,
      description: 'Redesigned the onboarding flow and cut drop-off by a third.',
    },
    education: { degree: 'BSc in Architecture', institution: 'BUET' },
  },
  {
    slug: 'mehjabin-chowdhury',
    name: 'Mehjabin Chowdhury',
    headline: 'Sales development — B2B SaaS',
    location: 'Dhaka',
    bio: 'Cold outreach, qualification and handover. I keep my own notes on why deals actually stalled.',
    experienceLevel: 'ENTRY',
    primarySector: 'SALES',
    skills: ['Prospecting', 'CRM', 'Cold Calling', 'Negotiation'],
    experience: {
      title: 'Sales Associate',
      company: 'Divine IT',
      years: 1,
      description: 'Booked 15 qualified meetings a month from cold outreach.',
    },
    education: { degree: 'BBA', institution: 'East West University' },
  },
  {
    slug: 'farhan-kabir',
    name: 'Farhan Kabir',
    headline: 'Operations coordinator — logistics and vendor management',
    location: 'Dhaka',
    bio: 'I keep delivery schedules and vendor paperwork in order for a mid-size e-commerce operation.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'OPERATIONS',
    skills: ['Excel', 'Vendor Management', 'Logistics', 'Reporting'],
    experience: {
      title: 'Operations Executive',
      company: 'Chaldal',
      years: 2,
      description: 'Coordinated daily dispatch across four warehouses.',
    },
    education: { degree: 'BBA in Supply Chain', institution: 'North South University' },
  },
  {
    slug: 'ishrat-binte-anwar',
    name: 'Ishrat Binte Anwar',
    headline: 'Customer support specialist, English and Bangla',
    location: 'Dhaka',
    bio: 'Three years on live chat and phone support for a health service. I write the macros our team uses.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'CUSTOMER_SUPPORT',
    skills: ['Live Chat', 'Zendesk', 'Communication', 'Escalation Handling'],
    experience: {
      title: 'Support Executive',
      company: 'Praava Health',
      years: 3,
      description: 'Handled 60 conversations a day at a 94% satisfaction score.',
    },
    education: { degree: 'BA in English', institution: 'Jahangirnagar University' },
  },
  {
    slug: 'shamima-akter',
    name: 'Shamima Akter',
    headline: 'Registered nurse — general and post-operative ward',
    location: 'Dhaka',
    bio: 'Five years of ward nursing, including two on a post-operative floor. BNMC registered.',
    experienceLevel: 'FIVE_PLUS',
    primarySector: 'HEALTHCARE',
    skills: ['Patient Care', 'Medication Administration', 'Wound Care', 'BNMC Registered'],
    experience: {
      title: 'Staff Nurse',
      company: 'Square Hospital',
      years: 5,
      description: 'Post-operative ward, 12 beds, three-shift rotation.',
    },
    education: { degree: 'BSc in Nursing', institution: 'Dhaka Nursing College' },
  },
  {
    slug: 'imran-hasan',
    name: 'Imran Hasan',
    headline: 'Secondary English teacher',
    location: 'Sylhet',
    bio: 'I teach English language and literature to classes six through ten, and I run the debate club.',
    experienceLevel: 'THREE_TO_FIVE',
    primarySector: 'EDUCATION',
    skills: ['Lesson Planning', 'Classroom Management', 'Curriculum Design', 'IELTS Coaching'],
    experience: {
      title: 'English Teacher',
      company: 'Scholastica',
      years: 4,
      description: 'Taught English to four sections and mentored two junior teachers.',
    },
    education: { degree: 'MA in English', institution: 'Shahjalal University' },
  },
  {
    slug: 'zarin-tasnim',
    name: 'Zarin Tasnim',
    headline: 'Final-year CS student looking for a machine learning internship',
    location: 'Dhaka',
    bio: 'Coursework in machine learning and two personal projects in computer vision. Looking for the first real one.',
    experienceLevel: 'ENTRY',
    primarySector: 'TECHNOLOGY',
    skills: ['Python', 'PyTorch', 'Pandas', 'Scikit-learn'],
    experience: {
      title: 'Research Assistant',
      company: 'BUET CSE',
      years: 1,
      description: 'Worked on a Bangla handwriting recognition dataset.',
    },
    education: { degree: 'BSc in Computer Science', institution: 'BUET' },
  },
  {
    slug: 'nabil-rahman',
    name: 'Nabil Rahman',
    headline: 'Procurement executive — industrial supply',
    location: 'Gazipur',
    bio: 'I negotiate with suppliers and keep the paperwork in a state that survives an audit.',
    experienceLevel: 'THREE_TO_FIVE',
    primarySector: 'OPERATIONS',
    skills: ['Procurement', 'Negotiation', 'Contract Management', 'ERP'],
    experience: {
      title: 'Procurement Officer',
      company: 'PRAN-RFL',
      years: 4,
      description: 'Managed a supplier base of 40 for packaging materials.',
    },
    education: { degree: 'BBA in Management', institution: 'University of Dhaka' },
  },
  {
    slug: 'sabrina-haque',
    name: 'Sabrina Haque',
    headline: 'Frontend developer — React and TypeScript',
    location: 'Dhaka',
    bio: 'I build interfaces and care about how they behave on a slow connection, because most of ours are.',
    experienceLevel: 'ONE_TO_THREE',
    primarySector: 'TECHNOLOGY',
    skills: ['React', 'TypeScript', 'CSS', 'Next.js', 'Accessibility'],
    experience: {
      title: 'Frontend Developer',
      company: 'Brain Station 23',
      years: 3,
      description: 'Rebuilt a customer portal used by 12,000 monthly visitors.',
    },
    education: { degree: 'BSc in Software Engineering', institution: 'Daffodil University' },
  },
  {
    slug: 'mahmudul-karim',
    name: 'Mahmudul Karim',
    headline: 'Financial analyst — reporting and forecasting',
    location: 'Dhaka',
    bio: 'Monthly management reporting and rolling forecasts for a group with five subsidiaries.',
    experienceLevel: 'THREE_TO_FIVE',
    primarySector: 'FINANCE',
    skills: ['Excel', 'Financial Modelling', 'Forecasting', 'Power BI'],
    experience: {
      title: 'Financial Analyst',
      company: 'ACI Limited',
      years: 4,
      description: 'Owned the monthly management pack for five subsidiaries.',
    },
    education: { degree: 'BBA in Finance', institution: 'IBA, Dhaka' },
  },
]

/**
 * Who applied where, and how far each one got.
 *
 * Spread across stages on purpose: the pipeline board has something in every
 * column, the analytics funnel has a shape rather than a single bar, and the
 * tracker shows what a real history looks like — including the two outcomes
 * nobody enjoys, because a demo that only shows offers is not a demo.
 */
type SeedApplication = {
  candidate: string
  job: string
  stage: ApplicationStage
  daysAgo: number
}

const APPLICATIONS: SeedApplication[] = [
  { candidate: 'arif-hossain', job: 'nexa-junior-backend-engineer', stage: 'INTERVIEW', daysAgo: 12 },
  { candidate: 'sabrina-haque', job: 'nexa-junior-backend-engineer', stage: 'SCREENING', daysAgo: 8 },
  { candidate: 'zarin-tasnim', job: 'nexa-junior-backend-engineer', stage: 'REJECTED', daysAgo: 20 },
  { candidate: 'arif-hossain', job: 'axiom-machine-learning-intern', stage: 'APPLIED', daysAgo: 3 },
  { candidate: 'zarin-tasnim', job: 'axiom-machine-learning-intern', stage: 'OFFER', daysAgo: 25 },
  { candidate: 'sabrina-haque', job: 'northstar-ui-ux-designer', stage: 'APPLIED', daysAgo: 2 },
  { candidate: 'rakib-islam', job: 'northstar-ui-ux-designer', stage: 'ASSESSMENT', daysAgo: 15 },
  { candidate: 'nusrat-jahan', job: 'bluepeak-digital-marketing-executive', stage: 'INTERVIEW', daysAgo: 10 },
  { candidate: 'mehjabin-chowdhury', job: 'bluepeak-digital-marketing-executive', stage: 'APPLIED', daysAgo: 1 },
  { candidate: 'tanvir-ahmed', job: 'meridian-accounts-officer', stage: 'OFFER', daysAgo: 22 },
  { candidate: 'mahmudul-karim', job: 'meridian-accounts-officer', stage: 'SCREENING', daysAgo: 6 },
  { candidate: 'nabil-rahman', job: 'meridian-accounts-officer', stage: 'WITHDRAWN', daysAgo: 18 },
  { candidate: 'sadia-rahman', job: 'lumen-hr-people-operations-executive', stage: 'ASSESSMENT', daysAgo: 14 },
  { candidate: 'ishrat-binte-anwar', job: 'lumen-hr-people-operations-executive', stage: 'APPLIED', daysAgo: 4 },
  { candidate: 'mehjabin-chowdhury', job: 'growthgrid-sales-development-representative', stage: 'INTERVIEW', daysAgo: 9 },
  { candidate: 'nusrat-jahan', job: 'growthgrid-sales-development-representative', stage: 'REJECTED', daysAgo: 28 },
  { candidate: 'farhan-kabir', job: 'pathao-operations-coordinator', stage: 'SCREENING', daysAgo: 7 },
  { candidate: 'nabil-rahman', job: 'pathao-operations-coordinator', stage: 'APPLIED', daysAgo: 2 },
  { candidate: 'ishrat-binte-anwar', job: 'novacare-customer-support-specialist', stage: 'OFFER', daysAgo: 21 },
  { candidate: 'sadia-rahman', job: 'novacare-customer-support-specialist', stage: 'APPLIED', daysAgo: 5 },
  { candidate: 'shamima-akter', job: 'greenlife-registered-nurse', stage: 'INTERVIEW', daysAgo: 11 },
  { candidate: 'imran-hasan', job: 'brightpath-english-teacher', stage: 'ASSESSMENT', daysAgo: 13 },
  { candidate: 'nabil-rahman', job: 'atlas-procurement-executive', stage: 'INTERVIEW', daysAgo: 16 },
  { candidate: 'farhan-kabir', job: 'atlas-procurement-executive', stage: 'APPLIED', daysAgo: 3 },
  { candidate: 'mahmudul-karim', job: 'atlas-procurement-executive', stage: 'REJECTED', daysAgo: 24 },
]

/** The stages an application passed through to reach the one it is on. */
const STAGE_ORDER: ApplicationStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER']

function historyFor(stage: ApplicationStage): ApplicationStage[] {
  // An exit can happen from anywhere; showing it straight after screening is the
  // commonest shape and keeps the funnel honest.
  if (stage === 'REJECTED' || stage === 'WITHDRAWN') return ['APPLIED', 'SCREENING', stage]

  const index = STAGE_ORDER.indexOf(stage)
  return STAGE_ORDER.slice(0, index + 1)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function seedCandidates(
  prisma: PrismaClient,
  jobIdBySlug: Map<string, string>,
  employerIdBySlug: Map<string, string>,
): Promise<{ candidates: number; applications: number }> {
  const profileIdBySlug = new Map<string, string>()

  for (const c of CANDIDATES) {
    const userId = `seed-candidate-${c.slug}`

    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        // A domain that cannot receive mail, so a demo row can never be
        // mistaken for a way to contact a real person.
        email: `${c.slug}@candidate.seed.careermate.local`,
        name: c.name,
        role: 'CANDIDATE',
        onboardedAt: daysAgo(40),
      },
      update: { name: c.name },
      select: { id: true },
    })

    const profile = await prisma.candidateProfile.upsert({
      where: { userId },
      create: {
        userId,
        headline: c.headline,
        location: c.location,
        bio: c.bio,
        experienceLevel: c.experienceLevel,
        primarySector: c.primarySector,
      },
      update: {
        headline: c.headline,
        location: c.location,
        bio: c.bio,
        experienceLevel: c.experienceLevel,
        primarySector: c.primarySector,
      },
      select: { id: true },
    })
    profileIdBySlug.set(c.slug, profile.id)

    for (const name of c.skills) {
      await prisma.skill.upsert({
        where: { candidateProfileId_name: { candidateProfileId: profile.id, name } },
        create: { candidateProfileId: profile.id, name },
        update: {},
      })
    }

    // Experience and education have no natural key, so they are replaced rather
    // than upserted — otherwise a second run would stack duplicates.
    await prisma.experience.deleteMany({ where: { candidateProfileId: profile.id } })
    await prisma.experience.create({
      data: {
        candidateProfileId: profile.id,
        title: c.experience.title,
        company: c.experience.company,
        location: c.location,
        startDate: daysAgo(c.experience.years * 365),
        isCurrent: true,
        description: c.experience.description,
      },
    })

    await prisma.education.deleteMany({ where: { candidateProfileId: profile.id } })
    await prisma.education.create({
      data: {
        candidateProfileId: profile.id,
        degree: c.education.degree,
        institution: c.education.institution,
      },
    })
  }

  let applicationCount = 0

  for (const a of APPLICATIONS) {
    const candidateProfileId = profileIdBySlug.get(a.candidate)
    const jobId = jobIdBySlug.get(a.job)
    if (!candidateProfileId || !jobId) continue

    const appliedAt = daysAgo(a.daysAgo)

    const application = await prisma.application.upsert({
      where: { candidateProfileId_jobId: { candidateProfileId, jobId } },
      create: {
        candidateProfileId,
        jobId,
        stage: a.stage,
        consentedAt: appliedAt,
        createdAt: appliedAt,
      },
      update: { stage: a.stage },
      select: { id: true },
    })

    // The tracker renders this history, and the analytics funnel counts it. Both
    // would be empty without it, so the stages are replayed as if a human had
    // moved the application through them over the days since it arrived.
    await prisma.applicationEvent.deleteMany({ where: { applicationId: application.id } })

    const history = historyFor(a.stage)
    const employerSlug = a.job.split('-')[0] ?? ''
    const actorId = employerIdBySlug.get(employerSlug) ?? null

    for (const [i, toStage] of history.entries()) {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          fromStage: i === 0 ? null : (history[i - 1] ?? null),
          toStage,
          // Spread across the days since the application arrived, so a funnel
          // bucketed by day is not one spike.
          createdAt: daysAgo(Math.max(0, a.daysAgo - i * 3)),
          actorId: i === 0 ? null : actorId,
        },
      })
    }

    applicationCount += 1
  }

  return { candidates: CANDIDATES.length, applications: applicationCount }
}
