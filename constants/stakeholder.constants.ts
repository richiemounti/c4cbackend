// Constants for stakeholder categories and connection types for all tasks

export const STAKEHOLDER_CATEGORIES = [
  'National Government',
  'Local Government',
  'Communities Affected by the Project',
  'Women, Youth, and Vulnerable Groups',
  'Partner Agencies',
  'Our Organisation',
  'Resource Manager'
];

// Task 1: Choose a category
// Task 2: How is this group connected to the project?
export const STAKEHOLDER_CONNECTIONS = {
  'National Government': [
    {
      id: 'policy_oversight',
      label: 'Provides policy or regulatory oversight.',
      requiresDescription: true
    },
    {
      id: 'funding_support',
      label: 'Offers funding or financial support.',
      requiresDescription: true
    },
    {
      id: 'legal_compliance',
      label: 'Sets legal or compliance requirements.',
      requiresDescription: true
    },
    {
      id: 'project_implementation',
      label: 'Supports project implementation.',
      requiresDescription: true
    },
    {
      id: 'outcome_monitoring',
      label: 'Monitors project outcomes to align with national priorities.',
      requiresDescription: true
    }
  ],

  'Local Government': [
    {
      id: 'oversees_development_planning',
      label: 'Oversees development planning and coordination in the project area',
      requiresDescription: true
    },
    {
      id: 'provides_local_permits',
      label: 'Provides permits, clearances, or local approvals for project activities',
      requiresDescription: true
    },
    {
      id: 'supports_local_service_delivery',
      label: 'Supports local service delivery linked to project outcomes (e.g. health, education, agriculture)',
      requiresDescription: true
    },
    {
      id: 'participates_project_events',
      label: 'Participates in project launch events, consultations, or mobilisations',
      requiresDescription: true
    },
    {
      id: 'facilitates_community_communication',
      label: 'Facilitates communication between the project and local communities',
      requiresDescription: true
    },
    {
      id: 'monitors_comanages_outcomes',
      label: 'Monitors or co-manages environmental, social, or governance outcomes',
      requiresDescription: true
    },
    {
      id: 'hosts_implementing_partners',
      label: 'Hosts or houses implementing partners or technical staff',
      requiresDescription: true
    },
    {
      id: 'aligns_district_priorities',
      label: 'Aligns the project with district development priorities or sector plans',
      requiresDescription: true
    },
    {
      id: 'manages_public_resources',
      label: 'Manages or distributes public resources that intersect with project activities',
      requiresDescription: true
    }
  ],

  'Communities Affected by the Project': [
    {
      id: 'lives_in_area',
      label: 'Lives in or depends on the project area.',
      requiresDescription: true
    },
    {
      id: 'relies_on_outcomes',
      label: 'Relies on project outcomes for improved services (e.g., water, health, education).',
      requiresDescription: true
    },
    {
      id: 'faces_risks',
      label: 'Faces potential risks from project activities (e.g., displacement or environmental changes).',
      requiresDescription: true
    },
    {
      id: 'provides_knowledge',
      label: 'Provides local knowledge or participation for project success.',
      requiresDescription: true
    },
    {
      id: 'represents_groups',
      label: 'Represents cultural or social groups directly impacted by decisions.',
      requiresDescription: true
    },
    {
      id: 'responsible_implementation',
      label: 'Responsible for the implementation of project activities.',
      requiresDescription: true
    }
  ],

  'Women, Youth, and Vulnerable Groups': [
    {
      id: 'advocates_rights',
      label: 'Advocates for their rights to be included in project planning and benefits.',
      requiresDescription: true
    },
    {
      id: 'relies_on_equality',
      label: 'Relies on project outcomes to address inequality or access to opportunities.',
      requiresDescription: true
    },
    {
      id: 'faces_challenges',
      label: 'Faces systemic challenges that the project seeks to address (e.g., discrimination, barriers to resources).',
      requiresDescription: true
    },
    {
      id: 'provides_perspectives',
      label: 'Provides unique perspectives or lived experiences critical to the project.',
      requiresDescription: true
    },
    {
      id: 'risks_exclusion',
      label: 'Risks being excluded without intentional outreach and engagement.',
      requiresDescription: true
    }
  ],

  'Partner Agencies': [
    {
      id: 'collaborates',
      label: 'Collaborates to design, finance, and/or implement the project.',
      requiresDescription: true
    },
    {
      id: 'provides_expertise',
      label: 'Provides technical expertise and/or resources.',
      requiresDescription: true
    },
    {
      id: 'supports_monitoring',
      label: 'Supports monitoring and evaluation.',
      requiresDescription: true
    },
    {
      id: 'acts_bridge',
      label: 'Acts as a bridge to reach specific communities or stakeholders.',
      requiresDescription: true
    },
    {
      id: 'aligns_goals',
      label: 'Aligns the project with broader organisational goals or joint initiatives.',
      requiresDescription: true
    },
    {
      id: 'works_landscape',
      label: 'Working (or previously worked) in the landscape.',
      requiresDescription: true
    }
  ],

  'Our Organisation': [
    {
      id: 'manages_resources',
      label: 'Manages the natural resource.',
      requiresDescription: true
    },
    {
      id: 'leads_implementation',
      label: 'Leads the design, development and implementation of the project.',
      requiresDescription: true
    },
    {
      id: 'communicates_impacts',
      label: "Communicates the project's impacts.",
      requiresDescription: true
    },
    {
      id: 'coordinates_stakeholders',
      label: 'Coordinates between stakeholders to ensure alignment.',
      requiresDescription: true
    },
    {
      id: 'manages_monitoring',
      label: 'Manages the monitoring and evaluation process.',
      requiresDescription: true
    },
    {
      id: 'oversees_accountability',
      label: 'Oversees accountability and reporting.',
      requiresDescription: true
    },
    {
      id: 'liaises_government_communities',
      label: 'Liaises with Government and/or Communities.',
      requiresDescription: true
    }
  ],

  'Resource Manager': [
    {
      id: 'holds_land_resource_rights',
      label: 'Holds legal or customary rights over the land or resource',
      requiresDescription: true
    },
    {
      id: 'manages_collective_user_rights',
      label: 'Represents or manages collective resource user rights',
      requiresDescription: true
    },
    {
      id: 'oversees_resource_access',
      label: 'Oversees access and use of natural resources (e.g. grazing, forest, water)',
      requiresDescription: true
    },
    {
      id: 'sets_conservation_rules',
      label: 'Sets local rules for conservation or resource management',
      requiresDescription: true
    },
    {
      id: 'engages_land_use_planning',
      label: 'Engages in land-use planning and enforcement',
      requiresDescription: true
    },
    {
      id: 'acts_local_gatekeeper',
      label: 'Acts as a local gatekeeper or liaison for project entry',
      requiresDescription: true
    }
  ]
};

// Task 3: What influence does this group have on the project?
export const STAKEHOLDER_POWER = {
  'National Government': [
    {
      id: 'enforces_regulations',
      label: 'Enforces regulations and/or policies affecting the project.',
      requiresDescription: true
    },
    {
      id: 'oversees_carbon_revenue',
      label: 'Oversees the process of carbon revenue delivery and spending.',
      requiresDescription: true
    },
    {
      id: 'receives_carbon_revenue',
      label: 'Receives the carbon revenue.',
      requiresDescription: true
    },
    {
      id: 'grants_permissions',
      label: 'Grants permissions or approvals for project activities.',
      requiresDescription: true
    },
    {
      id: 'shapes_perception',
      label: 'Shapes public perception towards the project.',
      requiresDescription: true
    },
    {
      id: 'approves_registration',
      label: 'Approves registration of the project.',
      requiresDescription: true
    }
  ],

  'Local Government': [
    {
      id: 'approves_withholds_permissions',
      label: 'Approves or withholds local-level permissions or endorsements',
      requiresDescription: true
    },
    {
      id: 'influences_land_use_infrastructure',
      label: 'Influences land use, infrastructure, or public service delivery in the project area',
      requiresDescription: true
    },
    {
      id: 'shapes_community_perceptions',
      label: 'Shapes community perceptions of the project through local leadership',
      requiresDescription: true
    },
    {
      id: 'mobilises_community_resources',
      label: 'Mobilises community members or local resources for project implementation',
      requiresDescription: true
    },
    {
      id: 'enforces_bylaws_regulations',
      label: 'Enforces bylaws or regulations that affect project activities (e.g. environment, land, health)',
      requiresDescription: true
    },
    {
      id: 'resolves_escalates_disputes',
      label: 'Resolves or escalates local disputes or grievances related to the project',
      requiresDescription: true
    },
    {
      id: 'aligns_district_priorities',
      label: 'Aligns the project with district priorities and planning processes',
      requiresDescription: true
    },
    {
      id: 'influences_sector_coordination',
      label: 'Influences coordination across sectors (e.g. agriculture, environment, youth)',
      requiresDescription: true
    }
  ],

  'Communities Affected by the Project': [
    {
      id: 'determine_land_use',
      label: 'Determine land use plans.',
      requiresDescription: true
    },
    {
      id: 'protect_manage_resources',
      label: 'Protect and manage the natural resources (e.g. forest/mangroves/grasslands).',
      requiresDescription: true
    },
    {
      id: 'provides_local_knowledge',
      label: 'Provides local knowledge or insights.',
      requiresDescription: true
    },
    {
      id: 'participates_consultations',
      label: 'Participates in consultations and/or feedback sessions.',
      requiresDescription: true
    },
    {
      id: 'advocates_needs',
      label: 'Advocates for specific needs or changes.',
      requiresDescription: true
    },
    {
      id: 'mobilizes_community',
      label: 'Mobilises community action.',
      requiresDescription: true
    },
    {
      id: 'shares_resources',
      label: 'Shares land, resources, or labour critical to the project.',
      requiresDescription: true
    }
  ],

  'Women, Youth, and Vulnerable Groups': [
    {
      id: 'shares_perspectives',
      label: 'Shares unique perspectives or lived experiences.',
      requiresDescription: true
    },
    {
      id: 'targeted_with_revenue',
      label: 'Targeted with carbon revenue &/or services to ensure that they benefit.',
      requiresDescription: true
    },
    {
      id: 'highlights_gaps',
      label: 'Highlights gaps in project planning or implementation.',
      requiresDescription: true
    },
    {
      id: 'engages_advocacy',
      label: 'Engages in grassroots organising or advocacy.',
      requiresDescription: true
    },
    {
      id: 'provides_insights',
      label: 'Provides insights into systemic barriers or needs.',
      requiresDescription: true
    },
    {
      id: 'collaborates_community',
      label: 'Collaborates with the community affected by the projects',
      requiresDescription: true
    }
  ],

  'Partner Agencies': [
    {
      id: 'influences_project_priorities',
      label: 'Influences project priorities or design through strategic input',
      requiresDescription: true
    },
    {
      id: 'decision_making_authority',
      label: 'Has decision-making authority over specific project components',
      requiresDescription: true
    },
    {
      id: 'controls_funding',
      label: 'Controls or significantly influences funding or resource allocation',
      requiresDescription: true
    },
    {
      id: 'shapes_external_messaging',
      label: 'Shapes external messaging or narrative about the project',
      requiresDescription: true
    },
    {
      id: 'influences_government',
      label: 'Influences government decisions or policy affecting the project',
      requiresDescription: true
    },
    {
      id: 'drives_tool_adoption',
      label: 'Drives the adoption of specific tools, approaches, or standards',
      requiresDescription: true
    },
    {
      id: 'influences_mel',
      label: 'Influences monitoring, evaluation, and learning processes',
      requiresDescription: true
    }
  ],

  'Our Organisation': [
    {
      id: 'sets_strategic_direction',
      label: "Sets the project's strategic direction and overall priorities",
      requiresDescription: true
    },
    {
      id: 'controls_core_decisions',
      label: 'Controls core decisions around funding, scope, and delivery',
      requiresDescription: true
    },
    {
      id: 'influences_stakeholder_participation',
      label: 'Influences how other stakeholders participate or collaborate',
      requiresDescription: true
    },
    {
      id: 'shapes_external_narratives',
      label: "Shapes external narratives about the project's purpose and impact",
      requiresDescription: true
    },
    {
      id: 'guides_ethical_standards',
      label: 'Guides ethical, safeguarding, or inclusion standards adopted by others',
      requiresDescription: true
    },
    {
      id: 'leads_innovation',
      label: 'Leads on innovation, tools, or models that others follow',
      requiresDescription: true
    },
    {
      id: 'builds_legitimacy',
      label: 'Builds legitimacy for the project in the eyes of government, donors, or communities',
      requiresDescription: true
    },
    {
      id: 'drives_monitoring_learning',
      label: 'Drives monitoring, learning, and course correction across partners',
      requiresDescription: true
    }
  ],

  'Resource Manager': [
    {
      id: 'approves_denies_project_access',
      label: 'Approves or denies project access to land or resources',
      requiresDescription: true
    },
    {
      id: 'enforces_resource_rules',
      label: 'Enforces rules on resource use and benefit-sharing',
      requiresDescription: true
    },
    {
      id: 'mobilises_community_support',
      label: 'Mobilises community support or resistance',
      requiresDescription: true
    },
    {
      id: 'influences_rights_interpretation',
      label: 'Influences how rights are interpreted or contested',
      requiresDescription: true
    },
    {
      id: 'resolves_land_disputes',
      label: 'Plays a role in resolving land/resource disputes',
      requiresDescription: true
    },
    {
      id: 'shapes_legitimacy_perceptions',
      label: 'Shapes perceptions of legitimacy and fairness',
      requiresDescription: true
    }
  ]
};

// Task 4: How could the project enhance the group's well-being?
export const STAKEHOLDER_WELLBEING = {
  'National Government': [
    {
      id: 'advances_policy',
      label: 'Advances policy objectives or governance priorities.',
      requiresDescription: true
    },
    {
      id: 'enhances_services',
      label: 'Enhances public service delivery or infrastructure.',
      requiresDescription: true
    },
    {
      id: 'reduces_pressure',
      label: 'Reduces pressure on resources or services.',
      requiresDescription: true
    },
    {
      id: 'improves_outcomes',
      label: "Improves the region's economic and/or social outcomes.",
      requiresDescription: true
    },
    {
      id: 'aligns_political_goals',
      label: 'Aligns with political or electoral goals.',
      requiresDescription: true
    }
  ],

  'Local Government': [
    {
      id: 'strengthens_local_mandates',
      label: 'Strengthens delivery of local government mandates and development plans',
      requiresDescription: true
    },
    {
      id: 'builds_credibility_citizens',
      label: 'Builds credibility and trust with citizens through visible local impact',
      requiresDescription: true
    },
    {
      id: 'improves_stakeholder_coordination',
      label: 'Improves coordination with other stakeholders or sectors',
      requiresDescription: true
    },
    {
      id: 'enhances_staff_capacity',
      label: 'Enhances staff capacity through training, tools, or resources',
      requiresDescription: true
    },
    {
      id: 'supports_public_infrastructure',
      label: 'Supports public infrastructure or service delivery',
      requiresDescription: true
    },
    {
      id: 'provides_local_visibility',
      label: 'Provides recognition or visibility for local leadership',
      requiresDescription: true
    },
    {
      id: 'reduces_social_environmental_challenges',
      label: 'Reduces social or environmental challenges within the jurisdiction',
      requiresDescription: true
    },
    {
      id: 'attracts_future_funding',
      label: 'Helps attract future funding or partnerships to the district',
      requiresDescription: true
    }
  ],

  'Communities Affected by the Project': [
    {
      id: 'improves_access',
      label: 'Improves access to essential services or resources.',
      requiresDescription: true
    },
    {
      id: 'creates_opportunities',
      label: 'Creates economic opportunities (e.g., jobs, and income).',
      requiresDescription: true
    },
    {
      id: 'reduces_risks',
      label: 'Reduces risks to health and safety.',
      requiresDescription: true
    },
    {
      id: 'builds_resilience',
      label: 'Builds community resilience and/or cohesion.',
      requiresDescription: true
    },
    {
      id: 'enhances_quality',
      label: 'Enhances the long-term quality of life.',
      requiresDescription: true
    }
  ],

  'Women, Youth, and Vulnerable Groups': [
    {
      id: 'addresses_barriers',
      label: 'Addresses barriers to inclusion or equality.',
      requiresDescription: true
    },
    {
      id: 'improves_access_opportunities',
      label: 'Improves access to opportunities or resources.',
      requiresDescription: true
    },
    {
      id: 'reduces_risks_harm',
      label: 'Reduces risks of harm or exclusion.',
      requiresDescription: true
    },
    {
      id: 'builds_confidence',
      label: 'Builds confidence or empowerment through participation.',
      requiresDescription: true
    },
    {
      id: 'enhances_mobility',
      label: 'Enhances social or economic mobility.',
      requiresDescription: true
    }
  ],

  'Partner Agencies': [
    {
      id: 'enhances_credibility',
      label: 'Enhances credibility and public reputation through visible impact',
      requiresDescription: true
    },
    {
      id: 'advances_strategic_mission',
      label: 'Advances strategic mission or programmatic priorities',
      requiresDescription: true
    },
    {
      id: 'deepens_relationships',
      label: 'Deepens relationships with government, donors, or other influential stakeholders',
      requiresDescription: true
    },
    {
      id: 'unlocks_funding_opportunities',
      label: "Unlocks new funding or partnership opportunities linked to the project's success",
      requiresDescription: true
    },
    {
      id: 'demonstrates_effectiveness',
      label: "Demonstrates the agency's effectiveness, innovation, or added value",
      requiresDescription: true
    },
    {
      id: 'expands_footprint',
      label: "Expands the agency's footprint or influence in a key thematic or geographic area",
      requiresDescription: true
    },
    {
      id: 'strengthens_internal_capacity',
      label: 'Strengthens internal capacity through learning and collaboration',
      requiresDescription: true
    },
    {
      id: 'provides_visibility',
      label: 'Provides visibility or recognition for technical expertise or leadership',
      requiresDescription: true
    }
  ],

  'Our Organisation': [
    {
      id: 'builds_org_reputation',
      label: 'Builds organisational reputation or trust with communities, funders, or governments',
      requiresDescription: true
    },
    {
      id: 'demonstrates_delivery_capability',
      label: 'Demonstrates delivery capability and credibility to strategic partners',
      requiresDescription: true
    },
    {
      id: 'strengthens_staff_capacity',
      label: 'Strengthens staff capacity, wellbeing, and institutional knowledge',
      requiresDescription: true
    },
    {
      id: 'advances_strategic_goals',
      label: 'Advances long-term strategic goals or influence in the sector',
      requiresDescription: true
    },
    {
      id: 'secures_funding_contracts',
      label: 'Secures new funding, contracts, or growth opportunities',
      requiresDescription: true
    },
    {
      id: 'underpins_financial_sustainability',
      label: 'Underpins financial sustainability or improves core cost recovery',
      requiresDescription: true
    },
    {
      id: 'deepens_learning_innovation',
      label: 'Deepens learning and innovation that improves future work',
      requiresDescription: true
    },
    {
      id: 'strengthens_org_alignment',
      label: 'Strengthens organisational alignment and team motivation',
      requiresDescription: true
    },
    {
      id: 'increases_thought_leadership',
      label: 'Increases visibility or thought leadership in the sector or region',
      requiresDescription: true
    },
    {
      id: 'improves_governance_compliance',
      label: 'Contributes to governance or compliance improvements (e.g. safeguarding, EDI)',
      requiresDescription: true
    }
  ],

  'Resource Manager': [
    {
      id: 'strengthens_tenure_security',
      label: 'Strengthens land and resource tenure security',
      requiresDescription: true
    },
    {
      id: 'increases_governance_legitimacy',
      label: 'Increases legitimacy and recognition of governance structures',
      requiresDescription: true
    },
    {
      id: 'improves_community_relationships',
      label: 'Improves relationships with communities and authorities',
      requiresDescription: true
    },
    {
      id: 'unlocks_resource_access',
      label: 'Unlocks access to technical, legal, or financial resources',
      requiresDescription: true
    },
    {
      id: 'supports_sustainable_resource_use',
      label: 'Supports sustainable resource use and ecological restoration',
      requiresDescription: true
    },
    {
      id: 'builds_conflict_management_capacity',
      label: 'Builds capacity to manage conflict or change',
      requiresDescription: true
    }
  ]
};

// Task 5: What roles or responsibilities does this group have in the project?
export const STAKEHOLDER_ROLES = {
  'National Government': [
    {
      id: 'provides_guidance',
      label: 'Provides guidance or oversight.',
      requiresDescription: true
    },
    {
      id: 'allocates_resources',
      label: 'Allocates or monitors financial resources.',
      requiresDescription: true
    },
    {
      id: 'approves_compliance',
      label: 'Approves or enforces regulatory compliance.',
      requiresDescription: true
    },
    {
      id: 'liaison_public',
      label: 'Acts as a liaison between the project and the public.',
      requiresDescription: true
    },
    {
      id: 'supports_data',
      label: 'Supports data sharing or research efforts.',
      requiresDescription: true
    }
  ],

  'Local Government': [
    {
      id: 'provides_local_permits_approvals',
      label: 'Provides permits, letters of support, or formal approvals for project activities',
      requiresDescription: true
    },
    {
      id: 'coordinates_government_departments',
      label: 'Coordinates with other government departments or local actors',
      requiresDescription: true
    },
    {
      id: 'supports_community_mobilisation',
      label: 'Supports mobilisation, outreach, or communication with communities',
      requiresDescription: true
    },
    {
      id: 'hosts_project_activities',
      label: 'Hosts or facilitates project activities at district offices or public venues',
      requiresDescription: true
    },
    {
      id: 'participates_project_meetings',
      label: 'Participates in project launch, review, or planning meetings',
      requiresDescription: true
    },
    {
      id: 'monitors_local_compliance',
      label: 'Monitors implementation or compliance with local regulations',
      requiresDescription: true
    },
    {
      id: 'supports_conflict_resolution',
      label: 'Supports conflict resolution or grievance redress mechanisms',
      requiresDescription: true
    },
    {
      id: 'collects_shares_data',
      label: 'Collects or shares data relevant to project implementation',
      requiresDescription: true
    },
    {
      id: 'advocates_project_inclusion',
      label: 'Advocates for inclusion of the project in local development plans or budgets',
      requiresDescription: true
    },
    {
      id: 'convenes_carbon_stakeholders',
      label: 'Convenes community stakeholders to agree on how carbon revenue is used',
      requiresDescription: true
    },
    {
      id: 'holds_carbon_revenue',
      label: 'Holds or manages carbon revenue in a local government bank account',
      requiresDescription: true
    },
    {
      id: 'ensures_equitable_distribution',
      label: 'Ensures that carbon revenue is distributed in a way that benefits local communities equitably',
      requiresDescription: true
    },
    {
      id: 'reports_carbon_usage',
      label: 'Reports to the carbon project developer on how carbon funds have been used',
      requiresDescription: true
    }
  ],

  'Communities Affected by the Project': [
    {
      id: 'participates_consultations',
      label: 'Participates in consultations or co-design processes.',
      requiresDescription: true
    },
    {
      id: 'provides_feedback',
      label: 'Provides feedback on project impacts or progress.',
      requiresDescription: true
    },
    {
      id: 'contributes_labor',
      label: 'Contributes labour or resources.',
      requiresDescription: true
    },
    {
      id: 'decides_spending',
      label: 'Decides how to spend the carbon revenue.',
      requiresDescription: true
    },
    {
      id: 'supports_monitoring',
      label: 'Participates in monitoring or evaluation through.',
      requiresDescription: true
    }
  ],

  'Women, Youth, and Vulnerable Groups': [
    {
      id: 'shares_experiences',
      label: 'Shares lived experiences to inform project planning.',
      requiresDescription: true
    },
    {
      id: 'decides_carbon_revenue',
      label: 'Decides how to spend the carbon revenue.',
      requiresDescription: true
    },
    {
      id: 'benefits_revenue',
      label: 'Benefits from the carbon revenue and/or services financed by that revenue.',
      requiresDescription: true
    },
    {
      id: 'advocates_inclusion',
      label: 'Advocates for broader community inclusion.',
      requiresDescription: true
    },
    {
      id: 'contributes_monitoring',
      label: 'Contributes to monitoring and evaluation.',
      requiresDescription: true
    }
  ],

  'Partner Agencies': [
    {
      id: 'codesigns_strategy',
      label: 'Co-designs project strategy or delivery plans',
      requiresDescription: true
    },
    {
      id: 'provides_funding_support',
      label: 'Provides funding, technical assistance, or in-kind support',
      requiresDescription: true
    },
    {
      id: 'implements_activities',
      label: 'Implements specific project activities or deliverables',
      requiresDescription: true
    },
    {
      id: 'advises_operational',
      label: 'Advises on operational, legal, or compliance issues',
      requiresDescription: true
    },
    {
      id: 'leads_mel',
      label: 'Leads or supports monitoring, evaluation, and learning',
      requiresDescription: true
    },
    {
      id: 'facilitates_market_access',
      label: 'Facilitates access to markets, value chains, or investment partners',
      requiresDescription: true
    },
    {
      id: 'builds_local_capacity',
      label: 'Builds local capacity through training, mentoring, or institutional support',
      requiresDescription: true
    },
    {
      id: 'engages_advocacy_comms',
      label: 'Engages in advocacy or communication on behalf of the project',
      requiresDescription: true
    }
  ],

  'Our Organisation': [
    {
      id: 'oversees_strategy_delivery',
      label: 'Oversees overall project strategy, planning, and delivery',
      requiresDescription: true
    },
    {
      id: 'manages_budgets',
      label: 'Manages budgets, resources, and financial accountability',
      requiresDescription: true
    },
    {
      id: 'coordinates_partnerships',
      label: 'Coordinates partnerships and stakeholder relationships',
      requiresDescription: true
    },
    {
      id: 'serves_technical_lead',
      label: 'Serves as the technical lead on key components or methodologies',
      requiresDescription: true
    },
    {
      id: 'oversees_governance_compliance',
      label: 'Oversees governance, compliance, and risk management processes',
      requiresDescription: true
    },
    {
      id: 'leads_mel_design',
      label: 'Leads the design and implementation of monitoring, evaluation, and learning',
      requiresDescription: true
    },
    {
      id: 'manages_communications',
      label: 'Manages project communications, visibility, and external messaging',
      requiresDescription: true
    },
    {
      id: 'ensures_safeguarding',
      label: 'Ensures safeguarding, equity, and inclusion are embedded across delivery',
      requiresDescription: true
    },
    {
      id: 'represents_external_forums',
      label: 'Represents the project in external forums, coalitions, or policy spaces',
      requiresDescription: true
    }
  ],

  'Resource Manager': [
    {
      id: 'grants_access_user_rights',
      label: 'Grants access or user rights for project activities',
      requiresDescription: true
    },
    {
      id: 'oversees_local_enforcement',
      label: 'Oversees local enforcement of land/resource rules',
      requiresDescription: true
    },
    {
      id: 'monitors_compliance_agreements',
      label: 'Monitors compliance with use and conservation agreements',
      requiresDescription: true
    },
    {
      id: 'facilitates_community_dialogue',
      label: 'Facilitates dialogue between communities and implementers',
      requiresDescription: true
    },
    {
      id: 'supports_dispute_resolution',
      label: 'Supports dispute resolution or grievance mechanisms',
      requiresDescription: true
    },
    {
      id: 'ensures_benefit_sharing_accountability',
      label: 'Ensures accountability in benefit-sharing',
      requiresDescription: true
    }
  ]
};

// Task 6: What risks or negative impacts could this group face from the project?
// Note: This task uses free text input with sidebar suggestions. Options below serve as sidebar ideas.
export const STAKEHOLDER_RISKS = {
  'National Government': [
    {
      id: 'public_backlash',
      label: 'Public backlash if the project fails or causes harm',
      requiresDescription: true
    },
    {
      id: 'financial_losses',
      label: 'Financial losses if resources are misused',
      requiresDescription: true
    },
    {
      id: 'loss_trust',
      label: 'Loss of public trust due to project challenges',
      requiresDescription: true
    },
    {
      id: 'misalignment_priorities',
      label: 'Misalignment with other government priorities',
      requiresDescription: true
    },
    {
      id: 'strain_resources',
      label: 'Strain on public resources or services',
      requiresDescription: true
    }
  ],

  'Local Government': [],

  'Communities Affected by the Project': [
    {
      id: 'displacement',
      label: 'Displacement or loss of land/resources',
      requiresDescription: true
    },
    {
      id: 'increased_inequality',
      label: 'Increased inequality or exclusion',
      requiresDescription: true
    },
    {
      id: 'environmental_hazards',
      label: 'Environmental or health hazards',
      requiresDescription: true
    },
    {
      id: 'loss_identity',
      label: 'Loss of cultural or social identity',
      requiresDescription: true
    },
    {
      id: 'insufficient_consultation',
      label: 'Insufficient consultation leads to unmet needs',
      requiresDescription: true
    }
  ],

  'Women, Youth, and Vulnerable Groups': [
    {
      id: 'exclusion_decision',
      label: 'Exclusion from decision-making processes',
      requiresDescription: true
    },
    {
      id: 'increased_stigma',
      label: 'Increased stigmatisation or backlash',
      requiresDescription: true
    },
    {
      id: 'unintended_harm',
      label: 'Unintended harm from poorly planned interventions',
      requiresDescription: true
    },
    {
      id: 'displacement_resources',
      label: 'Displacement or loss of access to resources',
      requiresDescription: true
    },
    {
      id: 'overburdening',
      label: 'Overburdening them by involving them in ways that feel superficial or lack real influence',
      requiresDescription: true
    }
  ],

  'Partner Agencies': [
    {
      id: 'reputational_damage',
      label: 'Reputational damage from project failure',
      requiresDescription: true
    },
    {
      id: 'financial_losses',
      label: 'Financial losses if resources are mismanaged',
      requiresDescription: true
    },
    {
      id: 'strained_relationships',
      label: 'Strained relationships with other partners',
      requiresDescription: true
    },
    {
      id: 'lack_recognition',
      label: 'Lack of recognition for contributions',
      requiresDescription: true
    },
    {
      id: 'misalignment_goals',
      label: 'Misalignment with their organisational goals',
      requiresDescription: true
    }
  ],

  'Our Organisation': [
    {
      id: 'reputational_harm',
      label: 'Reputational harm if the project fails',
      requiresDescription: true
    },
    {
      id: 'strain_resources',
      label: 'The strain on resources or staff capacity',
      requiresDescription: true
    },
    {
      id: 'financial_losses',
      label: 'Financial losses or mismanagement',
      requiresDescription: true
    },
    {
      id: 'stakeholder_conflict',
      label: 'Stakeholder conflict or disengagement',
      requiresDescription: true
    }
  ],

  'Resource Manager': []
};

// Task 7: How might this group benefit from the project?
export const STAKEHOLDER_BENEFITS = {
  'National Government': [
    {
      id: 'achieves_goals',
      label: 'Achieves policy goals or governance objectives.',
      requiresDescription: true
    },
    {
      id: 'improves_trust',
      label: 'Improves public trust or reputation.',
      requiresDescription: true
    },
    {
      id: 'strengthens_partnerships',
      label: 'Strengthens partnerships with other stakeholders.',
      requiresDescription: true
    },
    {
      id: 'supports_development',
      label: 'Supports long-term economic or social development.',
      requiresDescription: true
    },
    {
      id: 'demonstrates_leadership',
      label: 'Demonstrates leadership or innovation in governance',
      requiresDescription: true
    }
  ],

  'Local Government': [
    {
      id: 'achieves_local_development_goals',
      label: 'Achieves local development goals or sector-specific targets',
      requiresDescription: true
    },
    {
      id: 'gains_resources_training',
      label: 'Gains access to additional resources, training, or technical support',
      requiresDescription: true
    },
    {
      id: 'strengthens_community_collaboration',
      label: 'Strengthens collaboration with community actors and NGOs',
      requiresDescription: true
    },
    {
      id: 'enhances_partnership_reputation',
      label: 'Enhances reputation and credibility through successful partnerships',
      requiresDescription: true
    },
    {
      id: 'improves_departmental_coordination',
      label: 'Improves coordination across departments or sectors',
      requiresDescription: true
    },
    {
      id: 'demonstrates_good_governance',
      label: 'Demonstrates good governance to higher levels of government or funders',
      requiresDescription: true
    },
    {
      id: 'strengthens_service_capacity',
      label: 'Strengthens capacity to deliver services or oversee local implementation',
      requiresDescription: true
    },
    {
      id: 'increases_partner_visibility',
      label: 'Increases visibility and engagement with external partners or donors',
      requiresDescription: true
    },
    {
      id: 'receives_carbon_revenue_share',
      label: 'Receives a share of carbon revenue or performance-based income from the project',
      requiresDescription: true
    },
    {
      id: 'builds_community_trust',
      label: 'Builds trust with communities by ensuring transparent benefit-sharing',
      requiresDescription: true
    }
  ],

  'Communities Affected by the Project': [
    {
      id: 'gains_access',
      label: 'Gains access to improved services or infrastructure.',
      requiresDescription: true
    },
    {
      id: 'creates_opportunities',
      label: 'Creates employment or economic opportunities.',
      requiresDescription: true
    },
    {
      id: 'strengthens_safety',
      label: 'Strengthens community safety or resilience.',
      requiresDescription: true
    },
    {
      id: 'preserves_heritage',
      label: 'Preserves or enhances cultural or natural heritage.',
      requiresDescription: true
    },
    {
      id: 'builds_capacity',
      label: 'Builds long-term capacity or skills.',
      requiresDescription: true
    }
  ],

  'Women, Youth, and Vulnerable Groups': [
    {
      id: 'gains_access_services',
      label: 'Gains access to services or resources.',
      requiresDescription: true
    },
    {
      id: 'strengthens_representation',
      label: 'Strengthens community representation or inclusion.',
      requiresDescription: true
    },
    {
      id: 'builds_empowerment',
      label: 'Empowers and/or strengthens leadership capacity.',
      requiresDescription: true
    },
    {
      id: 'reduces_barriers',
      label: 'Addresses systemic barriers or discrimination.',
      requiresDescription: true
    },
    {
      id: 'enhances_visibility',
      label: 'Enhances visibility and advocacy for their needs.',
      requiresDescription: true
    }
  ],

  'Partner Agencies': [
    {
      id: 'builds_networks',
      label: 'Builds stronger networks and strategic partnerships',
      requiresDescription: true
    },
    {
      id: 'advances_agency_mission',
      label: "Advances the agency's mission or development goals",
      requiresDescription: true
    },
    {
      id: 'gains_recognition',
      label: 'Gains recognition for technical expertise or successful delivery',
      requiresDescription: true
    },
    {
      id: 'strengthens_internal_capacity',
      label: 'Strengthens internal capacity, systems, or knowledge',
      requiresDescription: true
    },
    {
      id: 'expands_geographic_impact',
      label: "Expands the agency's geographic or thematic impact",
      requiresDescription: true
    },
    {
      id: 'unlocks_funding_streams',
      label: 'Unlocks new funding streams or earns performance-based revenue',
      requiresDescription: true
    },
    {
      id: 'gains_market_access',
      label: 'Gains access to new markets, clients, or investor relationships',
      requiresDescription: true
    },
    {
      id: 'enhances_reputation',
      label: 'Enhances reputation through high-integrity collaboration',
      requiresDescription: true
    }
  ],

  'Our Organisation': [
    {
      id: 'builds_partnerships',
      label: 'Builds stronger partnerships, coalitions, or aligned networks',
      requiresDescription: true
    },
    {
      id: 'advances_strategic_goals',
      label: 'Advances strategic goals and mission-aligned impact',
      requiresDescription: true
    },
    {
      id: 'gains_recognition_leadership',
      label: 'Gains recognition for leadership, innovation, or ethical practice',
      requiresDescription: true
    },
    {
      id: 'expands_org_visibility',
      label: 'Expands organisational visibility and influence in target geographies or sectors',
      requiresDescription: true
    },
    {
      id: 'secures_new_opportunities',
      label: 'Secures new opportunities for funding, scaling, or investment',
      requiresDescription: true
    },
    {
      id: 'strengthens_internal_systems',
      label: 'Strengthens internal systems, practices, or governance processes',
      requiresDescription: true
    },
    {
      id: 'enhances_staff_culture',
      label: 'Enhances staff capacity, morale, or organisational culture',
      requiresDescription: true
    },
    {
      id: 'generates_learning',
      label: 'Generates learning and insights to improve future programming',
      requiresDescription: true
    },
    {
      id: 'increases_org_resilience',
      label: 'Increases organisational resilience or financial stability',
      requiresDescription: true
    },
    {
      id: 'builds_public_trust',
      label: 'Builds public trust and legitimacy in the eyes of stakeholders',
      requiresDescription: true
    }
  ],

  'Resource Manager': [
    {
      id: 'gains_formal_recognition',
      label: 'Gains formal recognition of rights and responsibilities',
      requiresDescription: true
    },
    {
      id: 'accesses_capacity_resources',
      label: 'Accesses resources for capacity-building and governance',
      requiresDescription: true
    },
    {
      id: 'strengthens_social_capital',
      label: 'Strengthens social capital and leadership legitimacy',
      requiresDescription: true
    },
    {
      id: 'benefits_revenue_sharing',
      label: 'Benefits from revenue-sharing or project-related investments',
      requiresDescription: true
    },
    {
      id: 'increases_resource_management_ability',
      label: 'Increases ability to sustainably manage and protect resources',
      requiresDescription: true
    },
    {
      id: 'enhances_community_standing',
      label: 'Enhances standing with communities, state actors, and funders',
      requiresDescription: true
    }
  ]
};

// All the stakeholder tasks
export const STAKEHOLDER_TASKS = [
  {
    id: 'task1',
    name: 'Choose a category',
    type: 'category',
    required: true
  },
  {
    id: 'task2',
    name: 'How is this group connected to the project?',
    type: 'connections',
    required: true,
    ratingQuestion: 'How strongly connected is this group to the project and its outcomes?',
    ratingScale: { min: 1, max: 10, minLabel: 'Not at all connected', maxLabel: 'Very strongly connected' }
  },
  {
    id: 'task3',
    name: 'What influence does this group have on the project?',
    type: 'power',
    required: true,
    ratingQuestion: 'How much influence does this group have on the project?',
    ratingScale: { min: 1, max: 10, minLabel: 'No influence', maxLabel: 'Very high influence' }
  },
  {
    id: 'task4',
    name: "How could the project enhance the group's well-being?",
    type: 'wellbeing',
    required: true,
    ratingQuestion: "How much could the project enhance this group's well-being?",
    ratingScale: { min: 1, max: 10, minLabel: 'Not at all', maxLabel: 'Significantly' }
  },
  {
    id: 'task5',
    name: 'What roles or responsibilities does this group have in the project?',
    type: 'roles',
    required: true,
    ratingQuestion: "How significant is this group's role or responsibility in the project?",
    ratingScale: { min: 1, max: 10, minLabel: 'No role', maxLabel: 'Very significant role' }
  },
  {
    id: 'task6',
    name: 'What risks or negative impacts could this group face from the project?',
    type: 'risks',
    required: true,
    ratingQuestion: 'How likely is this group to face negative impacts from the project?',
    ratingScale: { min: 1, max: 10, minLabel: 'Very unlikely', maxLabel: 'Very likely' },
    allowCustom: true,
    freeText: true
  },
  {
    id: 'task7',
    name: 'How might this group benefit from the project?',
    type: 'benefits',
    required: true,
    ratingQuestion: 'How much could this group benefit from the project?',
    ratingScale: { min: 1, max: 10, minLabel: 'No benefit', maxLabel: 'Significant benefit' }
  }
];

// Helper function to get the appropriate options for a task and category
export function getOptionsForTaskAndCategory(taskType: string, category: string): any[] {
  switch (taskType) {
    case 'connections':
      return STAKEHOLDER_CONNECTIONS[category as keyof typeof STAKEHOLDER_CONNECTIONS] || [];
    case 'power':
      return STAKEHOLDER_POWER[category as keyof typeof STAKEHOLDER_POWER] || [];
    case 'wellbeing':
      return STAKEHOLDER_WELLBEING[category as keyof typeof STAKEHOLDER_WELLBEING] || [];
    case 'roles':
      return STAKEHOLDER_ROLES[category as keyof typeof STAKEHOLDER_ROLES] || [];
    case 'risks':
      return STAKEHOLDER_RISKS[category as keyof typeof STAKEHOLDER_RISKS] || [];
    case 'benefits':
      return STAKEHOLDER_BENEFITS[category as keyof typeof STAKEHOLDER_BENEFITS] || [];
    default:
      return [];
  }
}

// Helper function to get the label for a connection type
export function getOptionLabel(taskType: string, category: string, optionId: string): string {
  const options = getOptionsForTaskAndCategory(taskType, category);
  const option = options.find(o => o.id === optionId);
  return option?.label || optionId;
}

// Helper function to get all option labels for a task and category
export function getAllLabelsForTaskAndCategory(taskType: string, category: string): string[] {
  const options = getOptionsForTaskAndCategory(taskType, category);
  return options.map(o => o.label);
}
