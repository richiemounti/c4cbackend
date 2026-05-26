// constants/stakeholderMapping.constants.ts

// Define the standard category names
export const STAKEHOLDER_CATEGORIES = [
  'National Government',
  'Local Government',
  'Communities Affected by the Project',
  'Women, Youth, and Vulnerable Groups',
  'Partner Agencies',
  'Our Organisation',
  'Resource Manager'
];

// Define the task types
export const TASK_TYPES = [
  'connections',
  'power',
  'wellbeing',
  'roles',
  'risks',
  'benefits'
];

// Map task types to user-friendly names
export const TASK_TYPE_LABELS: Record<string, string> = {
  'connections': 'Connection to the project',
  'power': 'Influence on the project',
  'wellbeing': 'Enhancement of well-being',
  'roles': 'Roles/responsibilities in the project',
  'risks': 'Risks/negative impacts',
  'benefits': 'Potential benefits'
};

// Define the task prompts
export const TASK_PROMPTS: Record<string, {
  promptText: string,
  tooltipText: string,
  ratingPrompt: string,
  ratingMin: number,
  ratingMax: number,
  ratingMinLabel: string,
  ratingMaxLabel: string
}> = {
  'connections': {
    promptText: 'How is this group connected to the project?',
    tooltipText: "Why are we asking this? Helps map the nature of each stakeholder's involvement — whether direct or indirect — so you can understand the ecosystem around your work.",
    ratingPrompt: 'How strongly connected is this group to the project and its outcomes?',
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: 'Not at all connected',
    ratingMaxLabel: 'Very strongly connected'
  },
  'power': {
    promptText: 'What influence does this group have on the project?',
    tooltipText: "Why are we asking this? Reveals who holds power to change, support, block, or shape your project. This feeds into your risk and engagement strategies.",
    ratingPrompt: 'How much influence does this group have on the project?',
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: 'No influence',
    ratingMaxLabel: 'Very high influence'
  },
  'wellbeing': {
    promptText: "How could the project enhance the group's well-being?",
    tooltipText: "Why are we asking this? Uncovers how much this group stands to lose or gain — and where your project might have unintended consequences.",
    ratingPrompt: "How much could the project enhance this group's well-being?",
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: 'Not at all',
    ratingMaxLabel: 'Significantly'
  },
  'roles': {
    promptText: 'What roles or responsibilities does this group have in the project?',
    tooltipText: "Why are we asking this? Clarifies accountability and partnership structures — helping you track who is doing what, and who needs to be consulted or supported.",
    ratingPrompt: "How significant is this group's role or responsibility in the project?",
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: 'No role',
    ratingMaxLabel: 'Very significant role'
  },
  'risks': {
    promptText: 'What risks or negative impacts could this group face from the project?',
    tooltipText: "Why are we asking this? Identifies potential harms or tensions early, so you can design mitigating actions and safeguard equity.",
    ratingPrompt: 'How likely is this group to face negative impacts from the project?',
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: 'Very unlikely',
    ratingMaxLabel: 'Very likely'
  },
  'benefits': {
    promptText: 'How might this group benefit from the project?',
    tooltipText: "Why are we asking this? Captures tangible and intangible value for each group — which helps you demonstrate social impact and build trust.",
    ratingPrompt: 'How much could this group benefit from the project?',
    ratingMin: 1,
    ratingMax: 5,
    ratingMinLabel: 'No benefit',
    ratingMaxLabel: 'Significant benefit'
  }
};

// Task options for National Government category
export const NATIONAL_GOVERNMENT_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'policy_oversight', label: 'Provides policy or regulatory oversight.', requiresDescription: true },
    { optionId: 'funding_support', label: 'Offers funding or financial support.', requiresDescription: true },
    { optionId: 'legal_compliance', label: 'Sets legal or compliance requirements.', requiresDescription: true },
    { optionId: 'project_implementation', label: 'Supports project implementation.', requiresDescription: true },
    { optionId: 'outcome_monitoring', label: 'Monitors project outcomes to align with national priorities.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'enforces_regulations', label: 'Enforces regulations and/or policies affecting the project.', requiresDescription: true },
    { optionId: 'oversees_carbon_revenue', label: 'Oversees the process of carbon revenue delivery and spending.', requiresDescription: true },
    { optionId: 'receives_carbon_revenue', label: 'Receives the carbon revenue.', requiresDescription: true },
    { optionId: 'grants_permissions', label: 'Grants permissions or approvals for project activities.', requiresDescription: true },
    { optionId: 'shapes_perception', label: 'Shapes public perception towards the project.', requiresDescription: true },
    { optionId: 'approves_registration', label: 'Approves registration of the project.', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'advances_policy', label: 'Advances policy objectives or governance priorities.', requiresDescription: true },
    { optionId: 'enhances_services', label: 'Enhances public service delivery or infrastructure.', requiresDescription: true },
    { optionId: 'reduces_pressure', label: 'Reduces pressure on resources or services.', requiresDescription: true },
    { optionId: 'improves_outcomes', label: "Improves the region's economic and/or social outcomes.", requiresDescription: true },
    { optionId: 'aligns_political_goals', label: 'Aligns with political or electoral goals.', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'provides_guidance', label: 'Provides guidance or oversight.', requiresDescription: true },
    { optionId: 'allocates_resources', label: 'Allocates or monitors financial resources.', requiresDescription: true },
    { optionId: 'approves_compliance', label: 'Approves or enforces regulatory compliance.', requiresDescription: true },
    { optionId: 'liaison_public', label: 'Acts as a liaison between the project and the public.', requiresDescription: true },
    { optionId: 'supports_data', label: 'Supports data sharing or research efforts.', requiresDescription: true }
  ],
  'risks': [
    { optionId: 'public_backlash', label: 'Public backlash if the project fails or causes harm.', requiresDescription: true },
    { optionId: 'financial_losses', label: 'Financial losses if resources are misused.', requiresDescription: true },
    { optionId: 'loss_trust', label: 'Loss of public trust due to project challenges.', requiresDescription: true },
    { optionId: 'misalignment_priorities', label: 'Misalignment with other government priorities.', requiresDescription: true },
    { optionId: 'strain_resources', label: 'Strain on public resources or services.', requiresDescription: true }
  ],
  'benefits': [
    { optionId: 'achieves_goals', label: 'Achieves policy goals or governance objectives.', requiresDescription: true },
    { optionId: 'improves_trust', label: 'Improves public trust or reputation.', requiresDescription: true },
    { optionId: 'strengthens_partnerships', label: 'Strengthens partnerships with other stakeholders.', requiresDescription: true },
    { optionId: 'supports_development', label: 'Supports long-term economic or social development.', requiresDescription: true },
    { optionId: 'demonstrates_leadership', label: 'Demonstrates leadership or innovation in governance.', requiresDescription: true }
  ]
};

// Task options for Local Government category
export const LOCAL_GOVERNMENT_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'oversees_development_planning', label: 'Oversees development planning and coordination in the project area.', requiresDescription: true },
    { optionId: 'provides_local_permits', label: 'Provides permits, clearances, or local approvals for project activities.', requiresDescription: true },
    { optionId: 'supports_local_service_delivery', label: 'Supports local service delivery linked to project outcomes (e.g. health, education, agriculture).', requiresDescription: true },
    { optionId: 'participates_project_events', label: 'Participates in project launch events, consultations, or mobilisations.', requiresDescription: true },
    { optionId: 'facilitates_community_communication', label: 'Facilitates communication between the project and local communities.', requiresDescription: true },
    { optionId: 'monitors_comanages_outcomes', label: 'Monitors or co-manages environmental, social, or governance outcomes.', requiresDescription: true },
    { optionId: 'hosts_implementing_partners', label: 'Hosts or houses implementing partners or technical staff.', requiresDescription: true },
    { optionId: 'aligns_district_priorities', label: 'Aligns the project with district development priorities or sector plans.', requiresDescription: true },
    { optionId: 'manages_public_resources', label: 'Manages or distributes public resources that intersect with project activities.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'approves_withholds_permissions', label: 'Approves or withholds local-level permissions or endorsements.', requiresDescription: true },
    { optionId: 'influences_land_use_infrastructure', label: 'Influences land use, infrastructure, or public service delivery in the project area.', requiresDescription: true },
    { optionId: 'shapes_community_perceptions', label: 'Shapes community perceptions of the project through local leadership.', requiresDescription: true },
    { optionId: 'mobilises_community_resources', label: 'Mobilises community members or local resources for project implementation.', requiresDescription: true },
    { optionId: 'enforces_bylaws_regulations', label: 'Enforces bylaws or regulations that affect project activities (e.g. environment, land, health).', requiresDescription: true },
    { optionId: 'resolves_escalates_disputes', label: 'Resolves or escalates local disputes or grievances related to the project.', requiresDescription: true },
    { optionId: 'aligns_district_priorities', label: 'Aligns the project with district priorities and planning processes.', requiresDescription: true },
    { optionId: 'influences_sector_coordination', label: 'Influences coordination across sectors (e.g. agriculture, environment, youth).', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'strengthens_local_mandates', label: 'Strengthens delivery of local government mandates and development plans.', requiresDescription: true },
    { optionId: 'builds_credibility_citizens', label: 'Builds credibility and trust with citizens through visible local impact.', requiresDescription: true },
    { optionId: 'improves_stakeholder_coordination', label: 'Improves coordination with other stakeholders or sectors.', requiresDescription: true },
    { optionId: 'enhances_staff_capacity', label: 'Enhances staff capacity through training, tools, or resources.', requiresDescription: true },
    { optionId: 'supports_public_infrastructure', label: 'Supports public infrastructure or service delivery.', requiresDescription: true },
    { optionId: 'provides_local_visibility', label: 'Provides recognition or visibility for local leadership.', requiresDescription: true },
    { optionId: 'reduces_social_environmental_challenges', label: 'Reduces social or environmental challenges within the jurisdiction.', requiresDescription: true },
    { optionId: 'attracts_future_funding', label: 'Helps attract future funding or partnerships to the district.', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'provides_local_permits_approvals', label: 'Provides permits, letters of support, or formal approvals for project activities.', requiresDescription: true },
    { optionId: 'coordinates_government_departments', label: 'Coordinates with other government departments or local actors.', requiresDescription: true },
    { optionId: 'supports_community_mobilisation', label: 'Supports mobilisation, outreach, or communication with communities.', requiresDescription: true },
    { optionId: 'hosts_project_activities', label: 'Hosts or facilitates project activities at district offices or public venues.', requiresDescription: true },
    { optionId: 'participates_project_meetings', label: 'Participates in project launch, review, or planning meetings.', requiresDescription: true },
    { optionId: 'monitors_local_compliance', label: 'Monitors implementation or compliance with local regulations.', requiresDescription: true },
    { optionId: 'supports_conflict_resolution', label: 'Supports conflict resolution or grievance redress mechanisms.', requiresDescription: true },
    { optionId: 'collects_shares_data', label: 'Collects or shares data relevant to project implementation.', requiresDescription: true },
    { optionId: 'advocates_project_inclusion', label: 'Advocates for inclusion of the project in local development plans or budgets.', requiresDescription: true },
    { optionId: 'convenes_carbon_stakeholders', label: 'Convenes community stakeholders to agree on how carbon revenue is used.', requiresDescription: true },
    { optionId: 'holds_carbon_revenue', label: 'Holds or manages carbon revenue in a local government bank account.', requiresDescription: true },
    { optionId: 'ensures_equitable_distribution', label: 'Ensures that carbon revenue is distributed in a way that benefits local communities equitably.', requiresDescription: true },
    { optionId: 'reports_carbon_usage', label: 'Reports to the carbon project developer on how carbon funds have been used.', requiresDescription: true }
  ],
  'risks': [],
  'benefits': [
    { optionId: 'achieves_local_development_goals', label: 'Achieves local development goals or sector-specific targets.', requiresDescription: true },
    { optionId: 'gains_resources_training', label: 'Gains access to additional resources, training, or technical support.', requiresDescription: true },
    { optionId: 'strengthens_community_collaboration', label: 'Strengthens collaboration with community actors and NGOs.', requiresDescription: true },
    { optionId: 'enhances_partnership_reputation', label: 'Enhances reputation and credibility through successful partnerships.', requiresDescription: true },
    { optionId: 'improves_departmental_coordination', label: 'Improves coordination across departments or sectors.', requiresDescription: true },
    { optionId: 'demonstrates_good_governance', label: 'Demonstrates good governance to higher levels of government or funders.', requiresDescription: true },
    { optionId: 'strengthens_service_capacity', label: 'Strengthens capacity to deliver services or oversee local implementation.', requiresDescription: true },
    { optionId: 'increases_partner_visibility', label: 'Increases visibility and engagement with external partners or donors.', requiresDescription: true },
    { optionId: 'receives_carbon_revenue_share', label: 'Receives a share of carbon revenue or performance-based income from the project.', requiresDescription: true },
    { optionId: 'builds_community_trust', label: 'Builds trust with communities by ensuring transparent benefit-sharing.', requiresDescription: true }
  ]
};

// Task options for Communities Affected by the Project category
export const COMMUNITIES_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'lives_in_area', label: 'Lives in or depends on the project area.', requiresDescription: true },
    { optionId: 'relies_on_outcomes', label: 'Relies on project outcomes for improved services (e.g., water, health, education).', requiresDescription: true },
    { optionId: 'faces_risks', label: 'Faces potential risks from project activities (e.g., displacement or environmental changes).', requiresDescription: true },
    { optionId: 'provides_knowledge', label: 'Provides local knowledge or participation for project success.', requiresDescription: true },
    { optionId: 'represents_groups', label: 'Represents cultural or social groups directly impacted by decisions.', requiresDescription: true },
    { optionId: 'responsible_implementation', label: 'Responsible for the implementation of project activities.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'determine_land_use', label: 'Determine land use plans.', requiresDescription: true },
    { optionId: 'protect_manage_resources', label: 'Protect and manage the natural resources (e.g. forest/mangroves/grasslands).', requiresDescription: true },
    { optionId: 'provides_local_knowledge', label: 'Provides local knowledge or insights.', requiresDescription: true },
    { optionId: 'participates_consultations', label: 'Participates in consultations and/or feedback sessions.', requiresDescription: true },
    { optionId: 'advocates_needs', label: 'Advocates for specific needs or changes.', requiresDescription: true },
    { optionId: 'mobilizes_community', label: 'Mobilises community action.', requiresDescription: true },
    { optionId: 'shares_resources', label: 'Shares land, resources, or labour critical to the project.', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'improves_access', label: 'Improves access to essential services or resources.', requiresDescription: true },
    { optionId: 'creates_opportunities', label: 'Creates economic opportunities (e.g., jobs, and income).', requiresDescription: true },
    { optionId: 'reduces_risks', label: 'Reduces risks to health and safety.', requiresDescription: true },
    { optionId: 'builds_resilience', label: 'Builds community resilience and/or cohesion.', requiresDescription: true },
    { optionId: 'enhances_quality', label: 'Enhances the long-term quality of life.', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'participates_consultations', label: 'Participates in consultations or co-design processes.', requiresDescription: true },
    { optionId: 'provides_feedback', label: 'Provides feedback on project impacts or progress.', requiresDescription: true },
    { optionId: 'contributes_labor', label: 'Contributes labour or resources.', requiresDescription: true },
    { optionId: 'decides_spending', label: 'Decides how to spend the carbon revenue.', requiresDescription: true },
    { optionId: 'supports_monitoring', label: 'Participates in monitoring or evaluation.', requiresDescription: true }
  ],
  'risks': [
    { optionId: 'displacement', label: 'Displacement or loss of land/resources.', requiresDescription: true },
    { optionId: 'increased_inequality', label: 'Increased inequality or exclusion.', requiresDescription: true },
    { optionId: 'environmental_hazards', label: 'Environmental or health hazards.', requiresDescription: true },
    { optionId: 'loss_identity', label: 'Loss of cultural or social identity.', requiresDescription: true },
    { optionId: 'insufficient_consultation', label: 'Insufficient consultation leads to unmet needs.', requiresDescription: true }
  ],
  'benefits': [
    { optionId: 'gains_access', label: 'Gains access to improved services or infrastructure.', requiresDescription: true },
    { optionId: 'creates_opportunities', label: 'Creates employment or economic opportunities.', requiresDescription: true },
    { optionId: 'strengthens_safety', label: 'Strengthens community safety or resilience.', requiresDescription: true },
    { optionId: 'preserves_heritage', label: 'Preserves or enhances cultural or natural heritage.', requiresDescription: true },
    { optionId: 'builds_capacity', label: 'Builds long-term capacity or skills.', requiresDescription: true }
  ]
};

// Task options for Women, Youth, and Vulnerable Groups category
export const WOMEN_YOUTH_VULNERABLE_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'advocates_rights', label: 'Advocates for their rights to be included in project planning and benefits.', requiresDescription: true },
    { optionId: 'relies_on_equality', label: 'Relies on project outcomes to address inequality or access to opportunities.', requiresDescription: true },
    { optionId: 'faces_challenges', label: 'Faces systemic challenges that the project seeks to address (e.g., discrimination, barriers to resources).', requiresDescription: true },
    { optionId: 'provides_perspectives', label: 'Provides unique perspectives or lived experiences critical to the project.', requiresDescription: true },
    { optionId: 'risks_exclusion', label: 'Risks being excluded without intentional outreach and engagement.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'shares_perspectives', label: 'Shares unique perspectives or lived experiences.', requiresDescription: true },
    { optionId: 'targeted_with_revenue', label: 'Targeted with carbon revenue &/or services to ensure that they benefit.', requiresDescription: true },
    { optionId: 'highlights_gaps', label: 'Highlights gaps in project planning or implementation.', requiresDescription: true },
    { optionId: 'engages_advocacy', label: 'Engages in grassroots organising or advocacy.', requiresDescription: true },
    { optionId: 'provides_insights', label: 'Provides insights into systemic barriers or needs.', requiresDescription: true },
    { optionId: 'collaborates_community', label: 'Collaborates with the community affected by the project.', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'addresses_barriers', label: 'Addresses barriers to inclusion or equality.', requiresDescription: true },
    { optionId: 'improves_access_opportunities', label: 'Improves access to opportunities or resources.', requiresDescription: true },
    { optionId: 'reduces_risks_harm', label: 'Reduces risks of harm or exclusion.', requiresDescription: true },
    { optionId: 'builds_confidence', label: 'Builds confidence or empowerment through participation.', requiresDescription: true },
    { optionId: 'enhances_mobility', label: 'Enhances social or economic mobility.', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'shares_experiences', label: 'Shares lived experiences to inform project planning.', requiresDescription: true },
    { optionId: 'decides_carbon_revenue', label: 'Decides how to spend the carbon revenue.', requiresDescription: true },
    { optionId: 'benefits_revenue', label: 'Benefits from the carbon revenue and/or services financed by that revenue.', requiresDescription: true },
    { optionId: 'advocates_inclusion', label: 'Advocates for broader community inclusion.', requiresDescription: true },
    { optionId: 'contributes_monitoring', label: 'Contributes to monitoring and evaluation.', requiresDescription: true }
  ],
  'risks': [
    { optionId: 'exclusion_decision', label: 'Exclusion from decision-making processes.', requiresDescription: true },
    { optionId: 'increased_stigma', label: 'Increased stigmatisation or backlash.', requiresDescription: true },
    { optionId: 'unintended_harm', label: 'Unintended harm from poorly planned interventions.', requiresDescription: true },
    { optionId: 'displacement_resources', label: 'Displacement or loss of access to resources.', requiresDescription: true },
    { optionId: 'overburdening', label: 'Overburdening them by involving them in ways that feel superficial or lack real influence.', requiresDescription: true }
  ],
  'benefits': [
    { optionId: 'gains_access_services', label: 'Gains access to services or resources.', requiresDescription: true },
    { optionId: 'strengthens_representation', label: 'Strengthens community representation or inclusion.', requiresDescription: true },
    { optionId: 'builds_empowerment', label: 'Empowers and/or strengthens leadership capacity.', requiresDescription: true },
    { optionId: 'reduces_barriers', label: 'Addresses systemic barriers or discrimination.', requiresDescription: true },
    { optionId: 'enhances_visibility', label: 'Enhances visibility and advocacy for their needs.', requiresDescription: true }
  ]
};

// Task options for Partner Agencies category
export const PARTNER_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'collaborates', label: 'Collaborates to design, finance, and/or implement the project.', requiresDescription: true },
    { optionId: 'provides_expertise', label: 'Provides technical expertise and/or resources.', requiresDescription: true },
    { optionId: 'supports_monitoring', label: 'Supports monitoring and evaluation.', requiresDescription: true },
    { optionId: 'acts_bridge', label: 'Acts as a bridge to reach specific communities or stakeholders.', requiresDescription: true },
    { optionId: 'aligns_goals', label: 'Aligns the project with broader organisational goals or joint initiatives.', requiresDescription: true },
    { optionId: 'works_landscape', label: 'Working (or previously worked) in the landscape.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'influences_project_priorities', label: 'Influences project priorities or design through strategic input.', requiresDescription: true },
    { optionId: 'decision_making_authority', label: 'Has decision-making authority over specific project components.', requiresDescription: true },
    { optionId: 'controls_funding', label: 'Controls or significantly influences funding or resource allocation.', requiresDescription: true },
    { optionId: 'shapes_external_messaging', label: 'Shapes external messaging or narrative about the project.', requiresDescription: true },
    { optionId: 'influences_government', label: 'Influences government decisions or policy affecting the project.', requiresDescription: true },
    { optionId: 'drives_tool_adoption', label: 'Drives the adoption of specific tools, approaches, or standards.', requiresDescription: true },
    { optionId: 'influences_mel', label: 'Influences monitoring, evaluation, and learning processes.', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'enhances_credibility', label: 'Enhances credibility and public reputation through visible impact.', requiresDescription: true },
    { optionId: 'advances_strategic_mission', label: 'Advances strategic mission or programmatic priorities.', requiresDescription: true },
    { optionId: 'deepens_relationships', label: 'Deepens relationships with government, donors, or other influential stakeholders.', requiresDescription: true },
    { optionId: 'unlocks_funding_opportunities', label: "Unlocks new funding or partnership opportunities linked to the project's success.", requiresDescription: true },
    { optionId: 'demonstrates_effectiveness', label: "Demonstrates the agency's effectiveness, innovation, or added value.", requiresDescription: true },
    { optionId: 'expands_footprint', label: "Expands the agency's footprint or influence in a key thematic or geographic area.", requiresDescription: true },
    { optionId: 'strengthens_internal_capacity', label: 'Strengthens internal capacity through learning and collaboration.', requiresDescription: true },
    { optionId: 'provides_visibility', label: 'Provides visibility or recognition for technical expertise or leadership.', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'codesigns_strategy', label: 'Co-designs project strategy or delivery plans.', requiresDescription: true },
    { optionId: 'provides_funding_support', label: 'Provides funding, technical assistance, or in-kind support.', requiresDescription: true },
    { optionId: 'implements_activities', label: 'Implements specific project activities or deliverables.', requiresDescription: true },
    { optionId: 'advises_operational', label: 'Advises on operational, legal, or compliance issues.', requiresDescription: true },
    { optionId: 'leads_mel', label: 'Leads or supports monitoring, evaluation, and learning.', requiresDescription: true },
    { optionId: 'facilitates_market_access', label: 'Facilitates access to markets, value chains, or investment partners.', requiresDescription: true },
    { optionId: 'builds_local_capacity', label: 'Builds local capacity through training, mentoring, or institutional support.', requiresDescription: true },
    { optionId: 'engages_advocacy_comms', label: 'Engages in advocacy or communication on behalf of the project.', requiresDescription: true }
  ],
  'risks': [
    { optionId: 'reputational_damage', label: 'Reputational damage from project failure.', requiresDescription: true },
    { optionId: 'financial_losses', label: 'Financial losses if resources are mismanaged.', requiresDescription: true },
    { optionId: 'strained_relationships', label: 'Strained relationships with other partners.', requiresDescription: true },
    { optionId: 'lack_recognition', label: 'Lack of recognition for contributions.', requiresDescription: true },
    { optionId: 'misalignment_goals', label: 'Misalignment with their organisational goals.', requiresDescription: true }
  ],
  'benefits': [
    { optionId: 'builds_networks', label: 'Builds stronger networks and strategic partnerships.', requiresDescription: true },
    { optionId: 'advances_agency_mission', label: "Advances the agency's mission or development goals.", requiresDescription: true },
    { optionId: 'gains_recognition', label: 'Gains recognition for technical expertise or successful delivery.', requiresDescription: true },
    { optionId: 'strengthens_internal_capacity', label: 'Strengthens internal capacity, systems, or knowledge.', requiresDescription: true },
    { optionId: 'expands_geographic_impact', label: "Expands the agency's geographic or thematic impact.", requiresDescription: true },
    { optionId: 'unlocks_funding_streams', label: 'Unlocks new funding streams or earns performance-based revenue.', requiresDescription: true },
    { optionId: 'gains_market_access', label: 'Gains access to new markets, clients, or investor relationships.', requiresDescription: true },
    { optionId: 'enhances_reputation', label: 'Enhances reputation through high-integrity collaboration.', requiresDescription: true }
  ]
};

// Task options for Our Organisation category
export const OUR_ORGANISATION_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'manages_resources', label: 'Manages the natural resource.', requiresDescription: true },
    { optionId: 'leads_implementation', label: 'Leads the design, development and implementation of the project.', requiresDescription: true },
    { optionId: 'communicates_impacts', label: "Communicates the project's impacts.", requiresDescription: true },
    { optionId: 'coordinates_stakeholders', label: 'Coordinates between stakeholders to ensure alignment.', requiresDescription: true },
    { optionId: 'manages_monitoring', label: 'Manages the monitoring and evaluation process.', requiresDescription: true },
    { optionId: 'oversees_accountability', label: 'Oversees accountability and reporting.', requiresDescription: true },
    { optionId: 'liaises_government_communities', label: 'Liaises with Government and/or Communities.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'sets_strategic_direction', label: "Sets the project's strategic direction and overall priorities.", requiresDescription: true },
    { optionId: 'controls_core_decisions', label: 'Controls core decisions around funding, scope, and delivery.', requiresDescription: true },
    { optionId: 'influences_stakeholder_participation', label: 'Influences how other stakeholders participate or collaborate.', requiresDescription: true },
    { optionId: 'shapes_external_narratives', label: "Shapes external narratives about the project's purpose and impact.", requiresDescription: true },
    { optionId: 'guides_ethical_standards', label: 'Guides ethical, safeguarding, or inclusion standards adopted by others.', requiresDescription: true },
    { optionId: 'leads_innovation', label: 'Leads on innovation, tools, or models that others follow.', requiresDescription: true },
    { optionId: 'builds_legitimacy', label: 'Builds legitimacy for the project in the eyes of government, donors, or communities.', requiresDescription: true },
    { optionId: 'drives_monitoring_learning', label: 'Drives monitoring, learning, and course correction across partners.', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'builds_org_reputation', label: 'Builds organisational reputation or trust with communities, funders, or governments.', requiresDescription: true },
    { optionId: 'demonstrates_delivery_capability', label: 'Demonstrates delivery capability and credibility to strategic partners.', requiresDescription: true },
    { optionId: 'strengthens_staff_capacity', label: 'Strengthens staff capacity, wellbeing, and institutional knowledge.', requiresDescription: true },
    { optionId: 'advances_strategic_goals', label: 'Advances long-term strategic goals or influence in the sector.', requiresDescription: true },
    { optionId: 'secures_funding_contracts', label: 'Secures new funding, contracts, or growth opportunities.', requiresDescription: true },
    { optionId: 'underpins_financial_sustainability', label: 'Underpins financial sustainability or improves core cost recovery.', requiresDescription: true },
    { optionId: 'deepens_learning_innovation', label: 'Deepens learning and innovation that improves future work.', requiresDescription: true },
    { optionId: 'strengthens_org_alignment', label: 'Strengthens organisational alignment and team motivation.', requiresDescription: true },
    { optionId: 'increases_thought_leadership', label: 'Increases visibility or thought leadership in the sector or region.', requiresDescription: true },
    { optionId: 'improves_governance_compliance', label: 'Contributes to governance or compliance improvements (e.g. safeguarding, EDI).', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'oversees_strategy_delivery', label: 'Oversees overall project strategy, planning, and delivery.', requiresDescription: true },
    { optionId: 'manages_budgets', label: 'Manages budgets, resources, and financial accountability.', requiresDescription: true },
    { optionId: 'coordinates_partnerships', label: 'Coordinates partnerships and stakeholder relationships.', requiresDescription: true },
    { optionId: 'serves_technical_lead', label: 'Serves as the technical lead on key components or methodologies.', requiresDescription: true },
    { optionId: 'oversees_governance_compliance', label: 'Oversees governance, compliance, and risk management processes.', requiresDescription: true },
    { optionId: 'leads_mel_design', label: 'Leads the design and implementation of monitoring, evaluation, and learning.', requiresDescription: true },
    { optionId: 'manages_communications', label: 'Manages project communications, visibility, and external messaging.', requiresDescription: true },
    { optionId: 'ensures_safeguarding', label: 'Ensures safeguarding, equity, and inclusion are embedded across delivery.', requiresDescription: true },
    { optionId: 'represents_external_forums', label: 'Represents the project in external forums, coalitions, or policy spaces.', requiresDescription: true }
  ],
  'risks': [
    { optionId: 'reputational_harm', label: 'Reputational harm if the project fails.', requiresDescription: true },
    { optionId: 'strain_resources', label: 'Strain on resources or staff capacity.', requiresDescription: true },
    { optionId: 'financial_losses', label: 'Financial losses or mismanagement.', requiresDescription: true },
    { optionId: 'stakeholder_conflict', label: 'Stakeholder conflict or disengagement.', requiresDescription: true }
  ],
  'benefits': [
    { optionId: 'builds_partnerships', label: 'Builds stronger partnerships, coalitions, or aligned networks.', requiresDescription: true },
    { optionId: 'advances_strategic_goals', label: 'Advances strategic goals and mission-aligned impact.', requiresDescription: true },
    { optionId: 'gains_recognition_leadership', label: 'Gains recognition for leadership, innovation, or ethical practice.', requiresDescription: true },
    { optionId: 'expands_org_visibility', label: 'Expands organisational visibility and influence in target geographies or sectors.', requiresDescription: true },
    { optionId: 'secures_new_opportunities', label: 'Secures new opportunities for funding, scaling, or investment.', requiresDescription: true },
    { optionId: 'strengthens_internal_systems', label: 'Strengthens internal systems, practices, or governance processes.', requiresDescription: true },
    { optionId: 'enhances_staff_culture', label: 'Enhances staff capacity, morale, or organisational culture.', requiresDescription: true },
    { optionId: 'generates_learning', label: 'Generates learning and insights to improve future programming.', requiresDescription: true },
    { optionId: 'increases_org_resilience', label: 'Increases organisational resilience or financial stability.', requiresDescription: true },
    { optionId: 'builds_public_trust', label: 'Builds public trust and legitimacy in the eyes of stakeholders.', requiresDescription: true }
  ]
};

// Task options for Resource Manager category
export const RESOURCE_MANAGER_OPTIONS: Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>> = {
  'connections': [
    { optionId: 'holds_land_resource_rights', label: 'Holds legal or customary rights over the land or resource.', requiresDescription: true },
    { optionId: 'manages_collective_user_rights', label: 'Represents or manages collective resource user rights.', requiresDescription: true },
    { optionId: 'oversees_resource_access', label: 'Oversees access and use of natural resources (e.g. grazing, forest, water).', requiresDescription: true },
    { optionId: 'sets_conservation_rules', label: 'Sets local rules for conservation or resource management.', requiresDescription: true },
    { optionId: 'engages_land_use_planning', label: 'Engages in land-use planning and enforcement.', requiresDescription: true },
    { optionId: 'acts_local_gatekeeper', label: 'Acts as a local gatekeeper or liaison for project entry.', requiresDescription: true }
  ],
  'power': [
    { optionId: 'approves_denies_project_access', label: 'Approves or denies project access to land or resources.', requiresDescription: true },
    { optionId: 'enforces_resource_rules', label: 'Enforces rules on resource use and benefit-sharing.', requiresDescription: true },
    { optionId: 'mobilises_community_support', label: 'Mobilises community support or resistance.', requiresDescription: true },
    { optionId: 'influences_rights_interpretation', label: 'Influences how rights are interpreted or contested.', requiresDescription: true },
    { optionId: 'resolves_land_disputes', label: 'Plays a role in resolving land/resource disputes.', requiresDescription: true },
    { optionId: 'shapes_legitimacy_perceptions', label: 'Shapes perceptions of legitimacy and fairness.', requiresDescription: true }
  ],
  'wellbeing': [
    { optionId: 'strengthens_tenure_security', label: 'Strengthens land and resource tenure security.', requiresDescription: true },
    { optionId: 'increases_governance_legitimacy', label: 'Increases legitimacy and recognition of governance structures.', requiresDescription: true },
    { optionId: 'improves_community_relationships', label: 'Improves relationships with communities and authorities.', requiresDescription: true },
    { optionId: 'unlocks_resource_access', label: 'Unlocks access to technical, legal, or financial resources.', requiresDescription: true },
    { optionId: 'supports_sustainable_resource_use', label: 'Supports sustainable resource use and ecological restoration.', requiresDescription: true },
    { optionId: 'builds_conflict_management_capacity', label: 'Builds capacity to manage conflict or change.', requiresDescription: true }
  ],
  'roles': [
    { optionId: 'grants_access_user_rights', label: 'Grants access or user rights for project activities.', requiresDescription: true },
    { optionId: 'oversees_local_enforcement', label: 'Oversees local enforcement of land/resource rules.', requiresDescription: true },
    { optionId: 'monitors_compliance_agreements', label: 'Monitors compliance with use and conservation agreements.', requiresDescription: true },
    { optionId: 'facilitates_community_dialogue', label: 'Facilitates dialogue between communities and implementers.', requiresDescription: true },
    { optionId: 'supports_dispute_resolution', label: 'Supports dispute resolution or grievance mechanisms.', requiresDescription: true },
    { optionId: 'ensures_benefit_sharing_accountability', label: 'Ensures accountability in benefit-sharing.', requiresDescription: true }
  ],
  'risks': [],
  'benefits': [
    { optionId: 'gains_formal_recognition', label: 'Gains formal recognition of rights and responsibilities.', requiresDescription: true },
    { optionId: 'accesses_capacity_resources', label: 'Accesses resources for capacity-building and governance.', requiresDescription: true },
    { optionId: 'strengthens_social_capital', label: 'Strengthens social capital and leadership legitimacy.', requiresDescription: true },
    { optionId: 'benefits_revenue_sharing', label: 'Benefits from revenue-sharing or project-related investments.', requiresDescription: true },
    { optionId: 'increases_resource_management_ability', label: 'Increases ability to sustainably manage and protect resources.', requiresDescription: true },
    { optionId: 'enhances_community_standing', label: 'Enhances standing with communities, state actors, and funders.', requiresDescription: true }
  ]
};

// Map category names to their option sets
export const CATEGORY_OPTIONS_MAP: Record<string, Record<string, Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}>>> = {
  'National Government': NATIONAL_GOVERNMENT_OPTIONS,
  'Local Government': LOCAL_GOVERNMENT_OPTIONS,
  'Communities Affected by the Project': COMMUNITIES_OPTIONS,
  'Women, Youth, and Vulnerable Groups': WOMEN_YOUTH_VULNERABLE_OPTIONS,
  'Partner Agencies': PARTNER_OPTIONS,
  'Our Organisation': OUR_ORGANISATION_OPTIONS,
  'Resource Manager': RESOURCE_MANAGER_OPTIONS
};

// Function to get task options for a specific category and task type
export const getOptionsForTaskAndCategory = (
  taskType: string,
  categoryName: string
): Array<{
  optionId: string,
  label: string,
  requiresDescription: boolean
}> => {
  if (!CATEGORY_OPTIONS_MAP[categoryName]) {
    return [];
  }

  if (!CATEGORY_OPTIONS_MAP[categoryName][taskType]) {
    return [];
  }

  return CATEGORY_OPTIONS_MAP[categoryName][taskType];
};

// Function to get the task prompt for a specific task type
export const getTaskPrompt = (taskType: string): {
  promptText: string,
  tooltipText: string,
  ratingPrompt: string,
  ratingMin: number,
  ratingMax: number,
  ratingMinLabel: string,
  ratingMaxLabel: string
} | null => {
  return TASK_PROMPTS[taskType] || null;
};
