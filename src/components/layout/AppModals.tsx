/**
 * AppModals — Lazy-loaded modal wrappers (CreateOpportunity, CreateAccount, CreateStaffingNeed, Settings).
 * Extracted from App.tsx to reduce its size.
 */

import { memo, Suspense, lazy } from "react";
import { useUIStore } from "../../stores/useUIStore";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useCrmData } from "../../queries/useCrmData";

const CreateOpportunityModal = lazy(() => import("../CreateOpportunityModal"));
const CreateAccountModal = lazy(() => import("../Modals/CreateAccountModal"));
const CreateStaffingNeedModal = lazy(() => import("../Modals/CreateStaffingNeedV2"));
const SettingsPanel = lazy(() => import("../SettingsPanel/SettingsPanel"));

interface AppModalsProps {
  allOpportunityData: Record<string, any>[];
  settingsOpen: boolean;
  onSettingsClose: () => void;
}

const AppModals = memo(({ allOpportunityData, settingsOpen, onSettingsClose }: AppModalsProps) => {
  const createModalOpen = useUIStore((s) => s.createModalOpen);
  const setCreateModalOpen = useUIStore((s) => s.setCreateModalOpen);
  const createAccountModalOpen = useUIStore((s) => s.createAccountModalOpen);
  const setCreateAccountModalOpen = useUIStore((s) => s.setCreateAccountModalOpen);
  const createStaffingNeedModalOpen = useUIStore((s) => s.createStaffingNeedModalOpen);
  const setCreateStaffingNeedModalOpen = useUIStore((s) => s.setCreateStaffingNeedModalOpen);
  const staffingNeedOpportunity = useUIStore((s) => s.staffingNeedOpportunity);
  const setStaffingNeedOpportunity = useUIStore((s) => s.setStaffingNeedOpportunity);
  const editOpportunity = useUIStore((s) => s.editOpportunity);
  const setEditOpportunity = useUIStore((s) => s.setEditOpportunity);

  const addManualOpportunity = useUserDataStore((s) => s.addManualOpportunity);
  const updateManualOpportunity = useUserDataStore((s) => s.updateManualOpportunity);
  const deleteManualOpportunity = useUserDataStore((s) => s.deleteManualOpportunity);
  const addManualAccount = useUserDataStore((s) => s.addManualAccount);
  const manualAccounts = useUserDataStore((s) => s.manualAccounts);

  const { filterOptions, crmAccounts, segmentToSubSegmentMap, serviceToOfferingMap } = useCrmData();

  return (
    <>
      <Suspense fallback={null}>
        <CreateOpportunityModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          editOpportunity={editOpportunity}
          setEditOpportunity={setEditOpportunity}
          onOpportunityCreated={addManualOpportunity}
          onOpportunityUpdated={updateManualOpportunity}
          onOpportunityDeleted={deleteManualOpportunity}
          onAccountCreated={addManualAccount}
          filterOptions={filterOptions}
          opportunityData={allOpportunityData}
          crmAccounts={crmAccounts}
          manualAccounts={manualAccounts}
          segmentToSubSegmentMap={segmentToSubSegmentMap}
          serviceToOfferingMap={serviceToOfferingMap}
        />
        <CreateAccountModal
          open={createAccountModalOpen}
          onClose={() => setCreateAccountModalOpen(false)}
          onAccountCreated={addManualAccount}
          crmAccounts={crmAccounts}
          segmentToSubSegmentMap={segmentToSubSegmentMap}
        />
        <CreateStaffingNeedModal
          open={createStaffingNeedModalOpen}
          onClose={() => {
            setCreateStaffingNeedModalOpen(false);
            setStaffingNeedOpportunity(null);
          }}
          opportunityData={allOpportunityData}
          initialOpportunity={staffingNeedOpportunity}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SettingsPanel open={settingsOpen} onClose={onSettingsClose} />
      </Suspense>
    </>
  );
});

AppModals.displayName = "AppModals";
export default AppModals;
