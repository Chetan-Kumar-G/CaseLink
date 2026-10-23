// Synthetic, fictional records for the prototype. Any resemblance to real
// institutions or people is coincidental.

export const institutions = [
  { permanentId: '1-2468013579', name: 'Sunrise Institute of Technology', type: 'Engineering', city: 'Nagpur', state: 'Maharashtra' },
  { permanentId: '1-1357924680', name: 'Vindhya College of Engineering', type: 'Engineering', city: 'Bhopal', state: 'Madhya Pradesh' },
  { permanentId: '1-9876543210', name: 'Coastal Institute of Management Studies', type: 'Management', city: 'Mangaluru', state: 'Karnataka' },
  { permanentId: '1-1122334455', name: 'Ganga Valley Polytechnic', type: 'Diploma', city: 'Varanasi', state: 'Uttar Pradesh' },
  { permanentId: '1-5566778899', name: 'Deccan School of Pharmacy', type: 'Pharmacy', city: 'Hyderabad', state: 'Telangana' },
  { permanentId: '1-6677889900', name: 'Northern Plains Institute of Engineering', type: 'Engineering', city: 'Ludhiana', state: 'Punjab' },
  { permanentId: '1-3344556677', name: 'Kaveri Institute of Architecture', type: 'Architecture', city: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { permanentId: '1-7788990011', name: 'Eastern Hills Institute of Technology', type: 'Engineering', city: 'Guwahati', state: 'Assam', approvalStatus: 'under_review' },
];

export const users = [
  { key: 'admin', name: 'System Administrator', email: 'admin@caselink.local', role: 'admin', designation: 'Platform administrator' },
  { key: 'reviewer', name: 'Meera Iyer', email: 'reviewer@caselink.local', role: 'senior_reviewer', designation: 'Senior reviewer, cross-bureau' },
  { key: 'pgrcHead', name: 'Sunita Deshpande', email: 'pgrc.head@caselink.local', role: 'bureau_head', bureau: 'PGRC', designation: 'Head, PGRC' },
  { key: 'pgrc', name: 'Rahul Verma', email: 'pgrc.officer@caselink.local', role: 'officer', bureau: 'PGRC', designation: 'Grievance officer' },
  { key: 'rb', name: 'Kavita Nair', email: 'rb.officer@caselink.local', role: 'officer', bureau: 'RB', designation: 'Regulation officer' },
  { key: 'ab', name: 'Arjun Mehta', email: 'ab.officer@caselink.local', role: 'officer', bureau: 'AB', designation: 'Approval officer' },
  { key: 'sunrisePortal', name: 'Registrar, Sunrise Institute', email: 'sunrise.portal@caselink.local', role: 'institution', institutionPid: '1-2468013579', designation: 'Institution grievance nodal officer' },
];

// daysAgo: when the case was registered. owner: seeded user key handling it.
export const cases = [
  // --- Demo scenario: Sunrise Institute of Technology (fee refunds) ---
  {
    inst: '1-2468013579', bureau: 'RB', owner: 'rb', daysAgo: 40, channel: 'inspection', category: 'fee_refund', priority: 'high', status: 'awaiting_institution',
    subject: 'Proceeding on retention of tuition fees after withdrawal',
    description: 'Regulation Bureau proceeding initiated on reports that the institute retains the full tuition fee of students who withdraw admission before the cut-off date, contrary to the fee refund policy. Show-cause notice issued; reply from the institute is awaited.',
    complainant: { name: 'Regulation Bureau (suo motu)' },
  },
  {
    inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 11, channel: 'portal', category: 'fee_refund', priority: 'high', status: 'under_review',
    subject: 'Fee refund not processed after withdrawal of admission',
    description: 'I withdrew my admission from the B.Tech programme in July and submitted the refund form with all documents. The institute has not refunded my tuition fee of Rs 85,000 even after three months, and the accounts office keeps asking me to come back later.',
    complainant: { name: 'Ananya Rao', email: 'ananya.rao@example.com', phone: '9800000011' },
  },
  {
    inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 26, channel: 'email', category: 'hostel', priority: 'medium', status: 'awaiting_institution',
    subject: 'Hostel mess hygiene and water supply',
    description: 'The boys hostel has had irregular drinking water supply for two weeks and the mess kitchen is not cleaned. Several students have fallen ill. Wardens have not acted on written requests.',
    complainant: { name: 'Karthik Menon', email: 'karthik.m@example.com' },
  },
  {
    inst: '1-2468013579', bureau: 'AB', owner: 'ab', daysAgo: 70, channel: 'inspection', category: 'infrastructure', priority: 'medium', status: 'under_review',
    subject: 'Laboratory equipment shortfall noted in approval inspection',
    description: 'Expert visit committee observed that the electronics and communication laboratories lack the minimum equipment listed in the approval handbook. Institute to submit compliance report.',
    complainant: { name: 'Approval Bureau (inspection)' },
  },

  {
    inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 33, channel: 'email', category: 'fee_refund', priority: 'medium', status: 'awaiting_institution',
    subject: 'Tuition fee not returned after seat surrender',
    description: 'I surrendered my seat in the first week of classes and applied for a refund. The institute has not returned the fee and says the refund is not possible this year.',
    complainant: { name: 'Mohit Jain', email: 'mohit.jain@example.com' },
  },
  {
    inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 52, channel: 'cpgrams', category: 'fee_refund', priority: 'medium', status: 'under_review',
    subject: 'Refund pending after cancellation of admission',
    description: 'My admission was cancelled at my request in August but the institute is still holding the full fee and has not given any reply about the refund.',
    complainant: { name: 'Sneha Kulkarni', email: 'sneha.k@example.com' },
  },
  {
    inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 300, channel: 'portal', category: 'fee_refund', priority: 'low', status: 'closed',
    subject: 'Delay in refund of caution money',
    description: 'Caution money refund was delayed for four months after I graduated. It has now been received after follow-up.',
    complainant: { name: 'Vikram Rao', email: 'vikram.rao@example.com' },
  },
  {
    inst: '1-7788990011', bureau: 'PGRC', owner: 'pgrc', daysAgo: 12, channel: 'portal', category: 'approval', priority: 'high', status: 'registered',
    subject: 'Validity of M.Tech degree from unapproved programme',
    description: 'Our M.Tech data science programme is reported to be without approval. The institute has not told us whether our degree will be valid and is still collecting fees.',
    complainant: { name: 'Riya Baruah', email: 'riya.b@example.com' },
  },

  // --- Vindhya: same complainant to two bureaus (exact duplicate) ---
  {
    inst: '1-1357924680', bureau: 'PGRC', owner: 'pgrc', daysAgo: 34, channel: 'portal', category: 'certificates', priority: 'high', status: 'under_review',
    subject: 'Original certificates withheld by the college',
    description: 'The college is refusing to return my original Class 10 and Class 12 certificates after I took a transfer. They are demanding payment of fees for the remaining course duration before returning them.',
    complainant: { name: 'Pooja Sharma', email: 'pooja.sharma@example.com', phone: '9800000022' },
  },
  {
    inst: '1-1357924680', bureau: 'AB', owner: 'ab', daysAgo: 29, channel: 'email', category: 'certificates', priority: 'high', status: 'registered',
    subject: 'Complaint regarding retention of original documents',
    description: 'Writing again as my complaint is still pending. Vindhya College has kept my original mark sheets and will not release them unless I pay fees for all four years. I need them for admission elsewhere.',
    complainant: { name: 'Pooja Sharma', email: 'pooja.sharma@example.com' },
  },
  {
    inst: '1-1357924680', bureau: 'RB', owner: 'rb', daysAgo: 90, channel: 'cpgrams', category: 'faculty', priority: 'medium', status: 'coordination',
    subject: 'Shortage of qualified faculty in mechanical department',
    description: 'Students report that most mechanical engineering classes are taken by guest lecturers and the department has only two regular faculty members against the approved intake.',
    complainant: { name: 'Student Council, Vindhya College', email: 'council.vce@example.com' },
  },

  // --- Coastal: Hindi + English excess-fee complaints (semantic) ---
  {
    inst: '1-9876543210', bureau: 'PGRC', owner: 'pgrc', daysAgo: 18, channel: 'portal', category: 'excess_fee', priority: 'medium', status: 'under_review',
    subject: 'संस्थान द्वारा अतिरिक्त शुल्क की मांग',
    description: 'संस्थान हमसे स्वीकृत शुल्क के अलावा विकास शुल्क के नाम पर पंद्रह हज़ार रुपये अतिरिक्त ले रहा है। रसीद भी नहीं दी जाती है।',
    complainant: { name: 'Rohit Yadav', phone: '9800000033' },
  },
  {
    inst: '1-9876543210', bureau: 'RB', owner: 'rb', daysAgo: 52, channel: 'letter', category: 'excess_fee', priority: 'medium', status: 'awaiting_institution',
    subject: 'Collection of development fee beyond approved fee structure',
    description: 'Parents association reports that the institute is collecting an additional development fee of Rs 15,000 per year over the approved fee without issuing receipts.',
    complainant: { name: 'Parents Association, CIMS', email: 'parents.cims@example.com' },
  },
  {
    inst: '1-9876543210', bureau: 'PGRC', owner: 'pgrc', daysAgo: 140, channel: 'email', category: 'scholarship', priority: 'low', status: 'resolved',
    subject: 'Scholarship amount not credited',
    description: 'My post-matric scholarship for the last semester has not been credited though the portal shows it as disbursed to the institute.',
    complainant: { name: 'Fatima Sheikh', email: 'fatima.s@example.com' },
  },

  // --- Ganga Valley ---
  {
    inst: '1-1122334455', bureau: 'PGRC', owner: 'pgrc', daysAgo: 6, channel: 'portal', category: 'harassment', priority: 'urgent', status: 'under_review',
    subject: 'Ragging of first-year students in hostel',
    description: 'First year diploma students are being ragged by seniors at night in the hostel. The anti-ragging committee has not responded to our complaint.',
    complainant: { name: 'Aman Gupta', email: 'aman.g@example.com' },
  },
  {
    inst: '1-1122334455', bureau: 'RB', owner: 'rb', daysAgo: 4, channel: 'cpgrams', category: 'harassment', priority: 'urgent', status: 'registered',
    subject: 'छात्रावास में रैगिंग की शिकायत',
    description: 'हमारे छात्रावास में वरिष्ठ छात्र रात में नए छात्रों की रैगिंग करते हैं। एंटी-रैगिंग समिति ने अब तक कोई कार्रवाई नहीं की है।',
    complainant: { name: 'Anonymous student' },
  },
  {
    inst: '1-1122334455', bureau: 'AB', owner: 'ab', daysAgo: 120, channel: 'inspection', category: 'approval', priority: 'medium', status: 'closed',
    subject: 'Admission beyond approved intake in civil engineering',
    description: 'Records show 78 admissions against an approved intake of 60 in diploma civil engineering for the current academic year.',
    complainant: { name: 'Approval Bureau (inspection)' },
  },

  // --- Deccan Pharmacy ---
  {
    inst: '1-5566778899', bureau: 'PGRC', owner: 'pgrc', daysAgo: 20, channel: 'portal', category: 'admission', priority: 'medium', status: 'awaiting_institution',
    subject: 'Admission cancelled without notice',
    description: 'My B.Pharm admission was cancelled without any written notice after I had paid the first instalment. The institute says the seat was given to another candidate.',
    complainant: { name: 'Sai Kiran', email: 'sai.kiran@example.com' },
  },
  {
    inst: '1-5566778899', bureau: 'AB', owner: 'ab', daysAgo: 45, channel: 'inspection', category: 'infrastructure', priority: 'low', status: 'under_review',
    subject: 'Pharmacognosy lab space below norms',
    description: 'Inspection found the pharmacognosy laboratory area below the prescribed carpet area and missing fume hoods.',
    complainant: { name: 'Approval Bureau (inspection)' },
  },

  // --- Northern Plains ---
  {
    inst: '1-6677889900', bureau: 'PGRC', owner: 'pgrc', daysAgo: 15, channel: 'email', category: 'fee_refund', priority: 'medium', status: 'registered',
    subject: 'Refund of caution deposit pending',
    description: 'I completed my B.Tech last year but the caution deposit of Rs 10,000 has not been refunded. Repeated emails to the accounts section got no reply.',
    complainant: { name: 'Harpreet Singh', email: 'harpreet.s@example.com' },
  },
  {
    inst: '1-6677889900', bureau: 'RB', owner: 'rb', daysAgo: 60, channel: 'cpgrams', category: 'faculty', priority: 'medium', status: 'under_review',
    subject: 'Faculty salaries not paid for four months',
    description: 'Faculty members of the institute have not received salaries for four months, affecting classes. Several faculty have resigned mid-semester.',
    complainant: { name: 'Faculty Welfare Association', email: 'fwa.npie@example.com' },
  },

  // --- Kaveri Architecture ---
  {
    inst: '1-3344556677', bureau: 'PGRC', owner: 'pgrc', daysAgo: 9, channel: 'portal', category: 'certificates', priority: 'medium', status: 'registered',
    subject: 'Degree certificate not issued after two years',
    description: 'I graduated from the B.Arch programme two years ago but the institute has still not issued my provisional degree certificate.',
    complainant: { name: 'Lakshmi Narayanan', email: 'lakshmi.n@example.com' },
  },

  // --- Eastern Hills: multi-bureau hotspot ---
  {
    inst: '1-7788990011', bureau: 'AB', owner: 'ab', daysAgo: 55, channel: 'inspection', category: 'approval', priority: 'high', status: 'under_review',
    subject: 'Running unapproved M.Tech programme',
    description: 'The institute is advertising and admitting students to an M.Tech programme in data science that does not have approval for the current academic year.',
    complainant: { name: 'Approval Bureau (inspection)' },
  },
  {
    inst: '1-7788990011', bureau: 'PGRC', owner: 'pgrc', daysAgo: 30, channel: 'portal', category: 'admission', priority: 'high', status: 'under_review',
    subject: 'Admitted to a course that is not approved',
    description: 'I took admission in the M.Tech data science course and paid fees. Now I learn the course is not approved. The institute is not giving a clear answer about my degree validity.',
    complainant: { name: 'Bikash Das', email: 'bikash.d@example.com' },
  },
  {
    inst: '1-7788990011', bureau: 'RB', owner: 'rb', daysAgo: 22, channel: 'cpgrams', category: 'approval', priority: 'high', status: 'registered',
    subject: 'Complaint on unapproved postgraduate course admissions',
    description: 'Complaint received through CPGRAMS alleging that the institute admitted around 40 students into an unapproved M.Tech data science programme and collected full fees.',
    complainant: { name: 'Nitin Borah', email: 'nitin.borah@example.com' },
  },
];

// Ready-to-paste demo complaint (Hindi) for Sunrise Institute — see README.
export const demoComplaint = {
  permanentId: '1-2468013579',
  category: 'fee_refund',
  channel: 'cpgrams',
  subject: 'प्रवेश वापस लेने के बाद फीस वापसी नहीं',
  description:
    'मैंने अगस्त में बी.टेक में प्रवेश वापस ले लिया था और सभी दस्तावेज़ जमा कर दिए थे। तीन महीने हो गए लेकिन संस्थान ने मेरी ट्यूशन फीस वापस नहीं की है और लेखा विभाग कोई जवाब नहीं देता।',
};
