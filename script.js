// script.js
let helpers = [];
let originalHelpers = [];
let currentPage = 1;
const helpersPerPage = 6;
let totalPages = 1;
let filteredHelpers = [];
const skillsMap = {
  housekeeping: "Housekeeping",
  cooking: "Cooking",
  childCare: "Child Care",
  infantCare: "Infant Care",
  elderCare: "Elder Care",
  petCare: "Pet Care"
};

// Notification function
function showNotification(message, type) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Copy name to clipboard function
function copyHelperName(name) {
  navigator.clipboard.writeText(name)
    .then(() => {
      showNotification(`Copied: ${name}`, 'success');
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      showNotification('Failed to copy name', 'error');
    });
}

// Extract numeric value from salary string
function extractSalary(salaryStr) {
  if (!salaryStr) return 0;
  
  // Match numbers in the salary string
  const matches = salaryStr.match(/\d+/g);
  if (!matches || matches.length === 0) return 0;
  
  // Convert to numbers and find the maximum value
  const nums = matches.map(match => parseInt(match, 10));
  return Math.max(...nums);
}

async function loadData() {
  try {
    document.getElementById('resultsCount').textContent = "Loading helpers...";
    // Show loading state
    document.getElementById('results').innerHTML = `
      <div class="empty-results">
        <i class="fas fa-spinner fa-spin"></i>
        <h3>Loading Helper Data</h3>
        <p>Please wait while we load helper information from the database</p>
      </div>
    `;

    // Fetch data from SheetBest API
    const res = await fetch('https://api.sheetbest.com/sheets/8da0a252-39e0-44ce-8f44-67f91884b9c1');
    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();

    // Check if we have data
    if (!json || json.length === 0) {
      throw new Error("No data available in the response");
    }

    // Convert API data to our format
    helpers = json.map(h => ({
      code: h["MDW Code"] || 'N/A',
      status: h["MDW Status"] || 'Available',
      name: h["MDW Name"] || 'Unknown',
      nationality: h["Nationality"] || 'Unknown',
      experience: h["MDW Experience"] || 'Not specified',
      dob: h["MDW DOB"] || '',
      height: (h["MDW Height"] || '').replace('cm', '').trim(),
      weight: (h["MDW Weight"] || '').replace('kg', '').trim(),
      restDay: h["Rest Day Arrangement"] || 'Not specified',
      housekeeping: h["Domestic Houskeeping"] === 'FALSE' ? false : true,
      cooking: h["Cooking"] === 'False' ? false : true,
      elderCare: h["Elder Care"] === 'TRUE',
      childCare: h["Child Care"] === 'TRUE',
      infantCare: h["Infant Care"] === 'TRUE',
      petCare: h["Pet Care"] === 'TRUE',
      comments: h["Interviewer Comments"] || 'No comments available',
      salary: h["Expected Salary"] || 'Not specified',
      religion: h["Religion"] || 'Not specified',
      salaryValue: extractSalary(h["Expected Salary"] || '') // Extract numeric salary
    }));

    // Calculate age and status flags
    helpers.forEach(h => {
      h.age = calculateAge(h.dob);
      h.isRejected = h.status.toLowerCase().includes('rejected');
      h.isWithdrew = h.status.toLowerCase().includes('void');
      h.isSelected = h.status.toLowerCase().includes('selected');
    });

    originalHelpers = [...helpers];

    // Filter non-rejected helpers
    const nonRejected = helpers.filter(h =>
      !h.isRejected && !h.isWithdrew && !h.isSelected
    );

    filteredHelpers = [...nonRejected];
    updatePagination(filteredHelpers);
    displayResults(getPaginatedData(filteredHelpers));

    document.getElementById('resultsCount').textContent =
      `${nonRejected.length} Helper${nonRejected.length === 1 ? '' : 's'} Found`;

    showNotification('Helpers data loaded successfully!', 'success');
  } catch (err) {
    console.error('Failed to load:', err);
    document.getElementById('results').innerHTML = `
      <div class="empty-results">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error Loading Data</h3>
        <p>${err.message || 'Please check your connection and try again later.'}</p>
        <button class="search-btn" onclick="loadData()" style="margin-top:20px;padding:12px 25px;">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
    document.getElementById('resultsCount').textContent = "Error loading data";
    showNotification('Failed to load helper data', 'error');
  }
}

function calculateAge(dob) {
  if (!dob) return null;

  // Parse date in format "D MMM YYYY", e.g., "1 Jan 1990"
  const parts = dob.trim().split(' ');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase();
  const year = parseInt(parts[2], 10);

  // Map month short names to numbers
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const month = months.indexOf(monthStr);
  if (month === -1 || isNaN(day) || isNaN(year)) return null;

  const birthDate = new Date(year, month, day);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function checkEnter(e) {
  if (e.key === 'Enter') searchHelpers();
}

// Get selected skills
function getSelectedSkills() {
  const skills = [];
  document.querySelectorAll('.skills-dropdown input[type="checkbox"]:checked').forEach(checkbox => {
    skills.push(checkbox.value);
  });
  return skills;
}

// Update selected skills display
function updateSelectedSkillsDisplay() {
  const selectedSkillsContainer = document.getElementById('selectedSkills');
  selectedSkillsContainer.innerHTML = '';
  
  const selectedSkills = getSelectedSkills();
  selectedSkills.forEach(skill => {
    const skillElement = document.createElement('div');
    skillElement.className = 'selected-skill';
    skillElement.innerHTML = `
      <span>${skillsMap[skill]}</span>
      <i class="fas fa-times" onclick="removeSkill('${skill}')"></i>
    `;
    selectedSkillsContainer.appendChild(skillElement);
  });
  
  // Update the skills select text
  const skillsSelect = document.getElementById('skillsSelect');
  if (selectedSkills.length > 0) {
    skillsSelect.querySelector('span').textContent = selectedSkills.map(skill => skillsMap[skill]).join(', ');
  } else {
    skillsSelect.querySelector('span').textContent = 'Select skills...';
  }
}

// Remove a selected skill
function removeSkill(skill) {
  const checkbox = document.getElementById(skill);
  if (checkbox) {
    checkbox.checked = false;
    updateSelectedSkillsDisplay();
  }
}

function searchHelpers() {
  const searchInput = document.getElementById('search').value.trim();
  const nationality = document.getElementById('nationality').value.toLowerCase();
  const experience = document.getElementById('experience').value.toLowerCase();
  const religion = document.getElementById('religion').value.toLowerCase();
  const heightRange = document.getElementById('heightRange').value;
  const weightRange = document.getElementById('weightRange').value;
  const salaryRange = document.getElementById('salaryRange').value;
  const sortBy = document.getElementById('sortBy').value;
  
  // Get selected skills
  const selectedSkills = getSelectedSkills();

  // Process search terms - split by comma or space and remove empty terms
  const searchTerms = searchInput
    .split(/[,\s]+/)
    .filter(term => term.length > 0)
    .map(term => term.toLowerCase());

  let heightMin = 0, heightMax = Infinity;
  if (heightRange) [heightMin, heightMax] = heightRange.split('-').map(Number);

  let weightMin = 0, weightMax = Infinity;
  if (weightRange) [weightMin, weightMax] = weightRange.split('-').map(Number);

  let salaryMin = 0, salaryMax = Infinity;
  if (salaryRange) [salaryMin, salaryMax] = salaryRange.split('-').map(Number);

  // Filter out rejected helpers first
  let filtered = helpers.filter(h => !h.isRejected && !h.isWithdrew && !h.isSelected);

  // Apply other filters
  filtered = filtered.filter(h => {
    const height = parseInt(h.height) || 0;
    const weight = parseInt(h.weight) || 0;
    const salary = h.salaryValue || 0;

    // Check if helper matches all search terms
    const matchesAllSearchTerms = searchTerms.length === 0 || 
      searchTerms.every(term => 
        h.name.toLowerCase().includes(term) || 
        h.comments.toLowerCase().includes(term) ||
        h.experience.toLowerCase().includes(term) ||
        h.restDay.toLowerCase().includes(term) ||
        h.salary.toLowerCase().includes(term)
      );
    
    // Check if helper has all selected skills
    const hasAllSelectedSkills = selectedSkills.every(skill => {
      switch(skill) {
        case 'housekeeping': return h.housekeeping;
        case 'cooking': return h.cooking;
        case 'childCare': return h.childCare;
        case 'infantCare': return h.infantCare;
        case 'elderCare': return h.elderCare;
        case 'petCare': return h.petCare;
        default: return true;
      }
    });

    return (
      matchesAllSearchTerms &&
      hasAllSelectedSkills &&
      (!nationality || h.nationality.toLowerCase() === nationality) &&
      (!experience || h.experience.toLowerCase() === experience) &&
      (!religion || h.religion.toLowerCase() === religion) &&
      (height >= heightMin && height <= heightMax) &&
      (weight >= weightMin && weight <= weightMax) &&
      (salary >= salaryMin && salary <= salaryMax)
    );
  });

  // Apply sorting
  if (sortBy) {
    const [key, order] = sortBy.split('-');
    filtered.sort((a, b) => {
      let valA, valB;

      switch (key) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        
        case 'height':
          valA = parseInt(a.height) || 0;
          valB = parseInt(b.height) || 0;
          return order === 'asc' ? valA - valB : valB - valA;
        
        case 'weight':
          valA = parseInt(a.weight) || 0;
          valB = parseInt(b.weight) || 0;
          return order === 'asc' ? valA - valB : valB - valA;
        
        case 'age':
          valA = a.age || 0;
          valB = b.age || 0;
          return order === 'asc' ? valA - valB : valB - valA;
        
        default:
          return 0;
      }
    });
  }

  filteredHelpers = [...filtered];
  currentPage = 1;
  updatePagination(filteredHelpers);
  displayResults(getPaginatedData(filteredHelpers));
  
  document.getElementById('resultsCount').textContent = `${filtered.length} Helper${filtered.length === 1 ? '' : 's'} Found`;
  
  if (filtered.length === 0) {
    showNotification('No helpers found with current filters', 'info');
  } else {
    showNotification(`Found ${filtered.length} helpers`, 'success');
  }
}

function resetFilters() {
  document.getElementById('search').value = '';
  document.getElementById('nationality').value = '';
  document.getElementById('experience').value = '';
  document.getElementById('religion').value = '';
  document.getElementById('heightRange').value = '';
  document.getElementById('weightRange').value = '';
  document.getElementById('salaryRange').value = '';
  document.getElementById('sortBy').value = '';
  
  // Reset skills
  document.querySelectorAll('.skills-dropdown input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectedSkillsDisplay();
  
  // Reset helpers to original state
  helpers = [...originalHelpers];
  const nonRejected = helpers.filter(h => !h.isRejected && !h.isWithdrew && !h.isSelected);
  filteredHelpers = [...nonRejected];
  currentPage = 1;
  updatePagination(filteredHelpers);
  displayResults(getPaginatedData(filteredHelpers));
  document.getElementById('resultsCount').textContent = `${nonRejected.length} Helper${nonRejected.length === 1 ? '' : 's'} Found`;
  
  showNotification('Filters have been reset', 'info');
}

// Get data for current page
function getPaginatedData(data) {
  const startIndex = (currentPage - 1) * helpersPerPage;
  const endIndex = startIndex + helpersPerPage;
  return data.slice(startIndex, endIndex);
}

// Update pagination UI
function updatePagination(data) {
  totalPages = Math.ceil(data.length / helpersPerPage);
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
  
  // Remove existing page number buttons
  document.querySelectorAll('.page-btn').forEach(btn => btn.remove());
  
  // Add page number buttons
  const paginationContainer = document.getElementById('pagination');
  const pageInfoElement = document.getElementById('pageInfo');
  
  // Calculate which page numbers to show
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);
  
  // Adjust if we're near the start
  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  }
  
  // Adjust if we're near the end
  if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }
  
  // Create page buttons
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.classList.add('pagination-btn', 'page-btn');
    if (i === currentPage) pageBtn.classList.add('active');
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      currentPage = i;
      updatePagination(filteredHelpers);
      displayResults(getPaginatedData(filteredHelpers));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    paginationContainer.insertBefore(pageBtn, pageInfoElement);
  }
}

// Next page function
function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    updatePagination(filteredHelpers);
    displayResults(getPaginatedData(filteredHelpers));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Previous page function
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    updatePagination(filteredHelpers);
    displayResults(getPaginatedData(filteredHelpers));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function displayResults(data) {
  const container = document.getElementById('results');
  if (data.length === 0) {
    container.innerHTML = `
      <div class="empty-results">
        <i class="fas fa-search"></i>
        <h3>No Helpers Found</h3>
        <p>Try adjusting your search criteria or using different keywords</p>
        <button class="search-btn" onclick="resetFilters()" style="margin-top:20px;padding:12px 25px;">
          <i class="fas fa-redo"></i> Reset Filters
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = data.map(h => `
    <div class="helper ${h.isRejected ? 'rejected' : ''}">
      <div class="helper-header">
        <div class="helper-name-container">
          <h3 class="helper-name">${h.name}</h3>
          <button class="copy-name-btn" onclick="copyHelperName('${h.name}')" title="Copy name">
            <i class="fas fa-copy"></i>
          </button>
        </div>
        <div class="helper-code">${h.code}</div>
      </div>
      
      <div class="helper-stats">
        <div class="stat-item">
          <span class="stat-label"><i class="fas fa-flag"></i> Nationality</span>
          <span class="stat-value">${h.nationality}</span>
        </div>
        
        <div class="stat-item">
          <span class="stat-label"><i class="fas fa-briefcase"></i> Experience</span>
          <span class="stat-value">${h.experience}</span>
        </div>
        
        <div class="stat-item">
          <span class="stat-label"><i class="fas fa-birthday-cake"></i> Age</span>
          <span class="stat-value">${h.age || 'N/A'} years</span>
        </div>
        
        <!-- Merged Height & Weight -->
        <div class="stat-item">
          <span class="stat-label"><i class="fas fa-user"></i> Height & Weight</span>
          <div class="merged-stat">
            <span><i class="fas fa-arrows-alt-v"></i> ${h.height || 'N/A'} cm</span>
            <span class="stat-divider">|</span>
            <span><i class="fas fa-weight"></i> ${h.weight || 'N/A'} kg</span>
          </div>
        </div>
        
        <!-- Merged Rest Day & Salary -->
        <div class="stat-item">
          <span class="stat-label"><i class="fas fa-calendar-day"></i> Rest day & Salary</span>
          <div class="merged-stat">
            <span><i class="fas fa-calendar"></i> ${h.restDay || 'N/A'}</span>
            <span class="stat-divider">|</span>
            <span><i class="fas fa-money-bill"></i> ${h.salary || 'N/A'}</span>
          </div>
        </div>
        
        <!-- Added Religion -->
        <div class="stat-item">
          <span class="stat-label"><i class="fas fa-pray"></i> Religion</span>
          <span class="stat-value">${h.religion || 'N/A'}</span>
        </div>
      </div>
      
      <div class="badge-container">
        <div class="badge ${h.housekeeping ? 'active' : ''}">
          <i class="fas fa-home"></i> Housekeep
        </div>
        
        <div class="badge ${h.cooking ? 'active' : ''}">
          <i class="fas fa-utensils"></i> Cooking
        </div>

        <div class="badge ${h.petCare ? 'active' : ''}">
          <i class="fas fa-paw"></i> Pet Care
        </div>
        
        <div class="badge ${h.childCare ? 'active' : ''}">
          <i class="fas fa-child"></i> Child Care
        </div>
        
        <div class="badge ${h.infantCare ? 'active' : ''}">
          <i class="fas fa-baby"></i> Infant Care
        </div>
        
        <div class="badge ${h.elderCare ? 'active' : ''}">
          <i class="fas fa-user-md"></i> Elder Care
        </div>
      </div>
      
      <div class="comments">
        <strong>Comments:</strong> ${h.comments}
      </div>
    </div>
  `).join('');
}

// Load data when page is ready
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  
  // Add event listeners for pagination
  document.getElementById('prevBtn').addEventListener('click', prevPage);
  document.getElementById('nextBtn').addEventListener('click', nextPage);
  
  // Skills filter dropdown toggle
  const skillsSelect = document.getElementById('skillsSelect');
  const skillsDropdown = document.getElementById('skillsDropdown');
  
  skillsSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    skillsDropdown.classList.toggle('active');
    skillsSelect.classList.toggle('active');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!skillsSelect.contains(e.target) {
      skillsDropdown.classList.remove('active');
      skillsSelect.classList.remove('active');
    }
  });
  
  // Update selected skills when a checkbox changes
  document.querySelectorAll('.skills-dropdown input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedSkillsDisplay);
  });
  
  // Initialize selected skills display
  updateSelectedSkillsDisplay();
});
