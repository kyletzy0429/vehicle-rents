import { supabase } from './config.js';
import { state, DEMO_ACCOUNTS, getActiveRole, setActiveRole, getActiveCustomerKey, setActiveCustomerKey } from './state.js';
import { $, $$, toast, openModal, closeModal } from './utils.js';
import { loadCategories, loadVehicles } from './vehicles.js';
import { openVehicleDetail } from './booking.js';

let authMode = 'login';

export async function switchSystemRole(role, customerKey = null) {
  if (role === 'customer') {
    const cust = DEMO_ACCOUNTS.customer || DEMO_ACCOUNTS.customer1;
    setActiveRole('customer');
    setActiveCustomerKey('customer1');
    state.user = { id: cust.id, email: cust.email };
    state.profile = { ...cust };
    state.portal = 'customer';
    state.tab = 'browse';
    toast(`Switched to Guest Portal`, 'info');
  } else if (role === 'staff') {
    const st = DEMO_ACCOUNTS.staff;
    setActiveRole('staff');
    state.user = { id: st.id, email: st.email };
    state.profile = { ...st };
    state.portal = 'staff';
    state.tab = 'dashboard';
    toast(`Switched to Staff Portal`, 'info');
    supabase.auth.signInWithPassword({
      email: 'staff@rentflow.ph',
      password: 'RentFlowStaff2026!'
    }).catch(err => console.warn('Staff auth note:', err));
  } else if (role === 'admin') {
    const adm = DEMO_ACCOUNTS.admin;
    setActiveRole('admin');
    state.user = { id: adm.id, email: adm.email };
    state.profile = { ...adm };
    state.portal = 'admin';
    state.tab = 'dashboard';
    toast(`Switched to Administrator Portal`, 'info');
    supabase.auth.signInWithPassword({
      email: 'admin@rentflow.ph',
      password: 'RentFlowAdmin2026!'
    }).catch(err => console.warn('Admin auth note:', err));
  }
  await Promise.all([loadCategories(), loadVehicles()]).catch(() => {});
  if (window.renderShell) window.renderShell();
}

export function renderAuth() {
  $('#app').innerHTML = `
    <div class="auth-wrap">
      <div class="glass auth-card">
        <div class="brand" style="display:flex;align-items:center;justify-content:center;margin-bottom:20px;text-align:center;">
          <div>
            <div class="brand-title" style="font-size:1.2rem;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">Vehicle Rental Management System</div>
            <div style="font-size:0.78rem;color:var(--text-mid);margin-top:4px;">Official Portal Sign In</div>
          </div>
        </div>

        <!-- Quick Portal Access -->
        <div style="margin-bottom:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">
            Demo Portal Access
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
            <button type="button" class="btn btn-ghost btn-sm" id="quickDemoGuest" style="background:#fff;border:1px solid #cbd5e1;font-size:0.78rem;padding:6px 4px;font-weight:600;border-radius:6px;">
              Guest
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="quickDemoStaff" style="background:#fff;border:1px solid #cbd5e1;font-size:0.78rem;padding:6px 4px;font-weight:600;border-radius:6px;">
              Manager
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="quickDemoAdmin" style="background:#fff;border:1px solid #cbd5e1;font-size:0.78rem;padding:6px 4px;font-weight:600;border-radius:6px;">
              Admin
            </button>
          </div>
        </div>

        <div class="auth-tabs">
          <div class="auth-tab ${authMode === 'login' ? 'active' : ''}" data-mode="login">
            <i class="fa-solid fa-right-to-bracket" style="margin-right:6px;"></i>Log In
          </div>
          <div class="auth-tab ${authMode === 'signup' ? 'active' : ''}" data-mode="signup">
            <i class="fa-solid fa-user-plus" style="margin-right:6px;"></i>Create Account
          </div>
        </div>
        <div id="authError"></div>
        <form id="authForm">
          ${authMode === 'signup' ? `
            <div class="field">
              <label>Full name</label>
              <input type="text" id="fullName" placeholder="e.g. Mark Lester Ramos" required />
            </div>
          ` : ''}
          <div class="field">
            <label>Email address</label>
            <input type="email" id="email" placeholder="e.g. user@example.com" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••" minlength="6" required />
          </div>
          ${authMode === 'signup' ? `
            <div class="field">
              <label>Sign up as</label>
              <div class="role-picker" id="rolePicker">
                <div class="role-opt selected" data-role="customer"><i class="fa-solid fa-user" style="margin-right:4px;"></i> Guest</div>
                <div class="role-opt" data-role="staff"><i class="fa-solid fa-user-tie" style="margin-right:4px;"></i> Manager</div>
                <div class="role-opt" data-role="admin"><i class="fa-solid fa-shield-halved" style="margin-right:4px;"></i> Administrator</div>
              </div>
            </div>
          ` : ''}
          <button type="submit" class="btn btn-primary btn-block" id="authSubmit" style="margin-top:8px;">
            ${authMode === 'login' ? '<i class="fa-solid fa-right-to-bracket"></i> Log In' : '<i class="fa-solid fa-user-check"></i> Create Account'}
          </button>
        </form>
      </div>
    </div>
  `;

  const qg = $('#quickDemoGuest');
  if (qg) qg.addEventListener('click', () => switchSystemRole('customer'));
  const qs = $('#quickDemoStaff');
  if (qs) qs.addEventListener('click', () => switchSystemRole('staff'));
  const qa = $('#quickDemoAdmin');
  if (qa) qa.addEventListener('click', () => switchSystemRole('admin'));

  $$('.auth-tab').forEach(t => t.addEventListener('click', () => { authMode = t.dataset.mode; renderAuth(); }));

  if (authMode === 'signup') {
    $$('.role-opt').forEach(opt => opt.addEventListener('click', () => {
      $$('.role-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    }));
  }

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = $('#authSubmit');
    submitBtn.disabled = true;
    $('#authError').innerHTML = '';
    const email = $('#email').value.trim();
    const password = $('#password').value;
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const fullName = $('#fullName').value.trim();
        const role = $('#rolePicker .selected').dataset.role;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        toast('Account created! Logging you in…', 'success');
      }
      await bootstrapSession();
    } catch (err) {
      $('#authError').innerHTML = `<div class="auth-error">${err.message}</div>`;
      submitBtn.disabled = false;
    }
  });
}

export async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  renderAuth();
}

export function promptCustomerOnboardingModal(force = false) {
  if (!state.user || state.portal !== 'customer') return;
  const p = state.profile || {};

  const isComplete = Boolean(p.phone);
  if (isComplete && !force) return;

  const dismissedKey = `rentflow_onboarding_seen_${state.user.id}`;
  if (!force && sessionStorage.getItem(dismissedKey)) return;

  openModal(`
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:800;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
          <i class="fa-solid fa-address-book"></i>
        </div>
        <div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-hi);margin:0;">Complete Contact Information</h3>
          <span style="font-size:0.75rem;color:var(--text-mid);">For fast booking notifications &amp; handover coordination</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="background:var(--accent-glow);border:1px solid var(--accent-blue);border-radius:10px;padding:12px 14px;margin-bottom:18px;display:flex;align-items:flex-start;gap:10px;">
      <i class="fa-solid fa-circle-info" style="color:var(--accent);font-size:1.1rem;margin-top:2px;"></i>
      <p style="margin:0;font-size:0.82rem;color:var(--text-hi);line-height:1.4;">
        Welcome to <strong>Vehicle Rental Management System</strong>! Please provide your phone number so our team can coordinate with you. <em>Note: Your physical driver's license will be verified in-person upon vehicle pickup / meetup.</em>
      </p>
    </div>

    <form id="onboardingForm">
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="field">
          <label>Full Name</label>
          <input type="text" id="obName" value="${p.full_name ?? ''}" placeholder="e.g. Mark Lester Ramos" required />
        </div>
        <div class="field">
          <label>Contact Phone Number</label>
          <input type="text" id="obPhone" value="${p.phone ?? ''}" placeholder="e.g. 0917 123 4567" required />
        </div>
      </div>

      <div class="field" style="margin-bottom:18px;">
        <label>Home / Delivery Address</label>
        <input type="text" id="obAddress" value="${p.address ?? ''}" placeholder="e.g. Puerto Princesa City, Palawan" />
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;margin-bottom:18px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-id-card" style="color:#059669;font-size:1rem;"></i>
        <span style="font-size:0.78rem;color:#166534;">No need to upload a license now — simply present your physical driver's license upon vehicle pickup.</span>
      </div>

      <div style="display:flex;gap:10px;margin-top:10px;">
        <button type="button" class="btn btn-ghost" id="obSkipBtn" style="flex:1;border:1px solid var(--glass-border);">I'll Do This Later</button>
        <button type="submit" class="btn btn-primary" id="obSubmitBtn" style="flex:2;">
          <i class="fa-solid fa-circle-check"></i> Save Details
        </button>
      </div>
    </form>
  `, true);

  $('#mClose').addEventListener('click', closeModal);
  $('#obSkipBtn').addEventListener('click', () => {
    sessionStorage.setItem(dismissedKey, 'true');
    closeModal();
  });

  $('#onboardingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = $('#obSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Profile…';

    const updated = {
      full_name: $('#obName').value.trim(),
      phone: $('#obPhone').value.trim(),
      address: $('#obAddress').value.trim(),
    };

    let { error } = await supabase.from('profiles').update(updated).eq('id', state.user.id);
    if (error) {
      const standardPayload = { full_name: updated.full_name, phone: updated.phone };
      await supabase.from('profiles').update(standardPayload).eq('id', state.user.id).catch(() => { });
    }

    try {
      localStorage.setItem(`rentflow_prof_${state.user.id}`, JSON.stringify(updated));
    } catch (err) { }

    Object.assign(state.profile, updated);
    toast('Contact details saved! You can now proceed to book.', 'success');
    sessionStorage.setItem(dismissedKey, 'true');
    closeModal();
    if (window.renderShell) {
      window.renderShell();
    }
  });
}

export async function bootstrapSession() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    if (demoParam) {
      if (demoParam === 'staff' || demoParam === 'manager') return switchSystemRole('staff');
      if (demoParam === 'admin') return switchSystemRole('admin');
      if (demoParam === 'customer2' || demoParam === 'maria') return switchSystemRole('customer', 'customer2');
      if (demoParam === 'customer3' || demoParam === 'alex') return switchSystemRole('customer', 'customer3');
      return switchSystemRole('customer', 'customer1');
    }

    const savedRole = localStorage.getItem('rentflow_active_role');
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    
    // If no session but user selected a demo role previously, keep that demo role
    if ((sessionErr || !session) && savedRole) {
      return switchSystemRole(savedRole);
    }

    if (sessionErr || !session) {
      // Default to customer demo for presentation ease
      return switchSystemRole('customer', 'customer1');
    }
    state.user = session.user;

    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
    if (error || !profile) {
      console.error('Profile load error:', error);
      toast('Could not load your profile. Try logging in again.', 'error');
      renderAuth();
      return;
    }

    try {
      const savedExtra = localStorage.getItem(`rentflow_prof_${state.user.id}`);
      if (savedExtra) Object.assign(profile, JSON.parse(savedExtra));
    } catch (e) { }

    state.profile = profile;
    state.portal = profile.role || 'customer';
    try {
      await Promise.all([loadCategories(), loadVehicles()]);
    } catch (loadErr) {
      console.warn('Error loading initial data:', loadErr);
    }
    if (window.renderShell) window.renderShell();

    const bookVehicleId = urlParams.get('book');
    if (bookVehicleId) {
      setTimeout(() => {
        openVehicleDetail(Number(bookVehicleId));
      }, 500);
    }

    if (state.portal === 'customer' && !bookVehicleId) {
      setTimeout(() => {
        promptCustomerOnboardingModal();
      }, 400);
    }
  } catch (fatalErr) {
    console.error('Fatal error during bootstrapSession:', fatalErr);
    renderAuth();
  }
}
